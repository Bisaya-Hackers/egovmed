# eGovMed anchoring contract

`RecordAnchor.sol` is the on-chain half of the tamper-evidence guarantee. Only sha256 fingerprints
of off-chain, encrypted health records are written to it. **No PHI, no identifiers, no clinical
content ever go on-chain** — that is a Data Privacy Act 2012 requirement, not a stylistic choice.

Backend integration lives in `backend/src/integrations/egovChain.js`. It expects the deployed
contract to expose exactly this ABI:

- `function anchor(bytes32 recordHash, string metadata) external returns (bool)`
- `function anchoredAt(bytes32 recordHash) external view returns (uint256)`  ← read-back verification
- `event Anchored(bytes32 indexed recordHash, address indexed submitter, uint256 timestamp)`

## Deploy

Target: Hyperledger Besu QBFT (eGovChain hackathon network).

| Setting        | Value                                     |
| -------------- | ----------------------------------------- |
| RPC URL        | `https://hackathon-blockchain.e.gov.ph`   |
| Chain ID       | `13371`                                   |
| Gas price      | `0` (zero-fee — no funding needed)        |
| Solidity       | `0.8.20`                                  |
| Explorer       | `https://hackathon-explorer.e.gov.ph`     |

You need a signer keypair first — the current `EGOVCHAIN_PRIVATE_KEY` slot in `backend/.env`
is empty. Generate one, deploy from it, then use the same key for anchoring. Once deployed,
that private key is as sensitive as `PHI_ENCRYPTION_KEY`: whoever holds it can write anchors
the app will treat as authentic. Store it in Vercel as a Sensitive env var and never commit it.

### Option A — Foundry (recommended)

```bash
# from repo root
forge create contracts/RecordAnchor.sol:RecordAnchor \
  --rpc-url https://hackathon-blockchain.e.gov.ph \
  --private-key $EGOVCHAIN_PRIVATE_KEY \
  --legacy \
  --gas-price 0
```

### Option B — Remix

1. Open `RecordAnchor.sol` in remix.ethereum.org, compile with 0.8.20.
2. In Deploy & Run, pick "Injected Provider" and point MetaMask at a custom network:
   RPC `https://hackathon-blockchain.e.gov.ph`, chain ID `13371`.
3. Deploy — MetaMask will show gas price 0.

### After deploying

1. Copy the deployed address into `backend/.env` and Vercel:
   ```bash
   cd backend
   vercel env add EGOVCHAIN_CONTRACT_ADDRESS production   # paste 0x…
   vercel env add EGOVCHAIN_PRIVATE_KEY   production      # paste 0x…
   ```
   Both must be Sensitive.
2. Record the deploy tx hash below.
3. Flip `EGOVCHAIN_MODE=live` in Vercel and redeploy.

## Deployment record

<!-- Fill in after deploy — do not delete this section, it is the audit trail. -->

| Field          | Value                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| Address        | `0x77cC3DeF1Cb29ad608316F11d62cE82A0cb9703E`                            |
| Deploy tx      | `0x8f55bb91c176f6cbb30753746672739d2e1b906f4ac2bb4d72fcf510483b4ffe`    |
| Deployer       | `0x711434A1365D899cF1507B9B25c11410198F73AC`                            |
| Deployed at    | `2026-07-31` (block 381081)                                             |
| Explorer URL   | `https://hackathon-explorer.e.gov.ph/address/0x77cC3DeF1Cb29ad608316F11d62cE82A0cb9703E` |

First anchor written in block 381097
(`0xed7f283e4156de91499a9cd3d7ce9ba2c79e79d501ff8515e86307ac78aefc6a`), verified by reading
`anchoredAt` back through the exact ABI declared in `backend/src/integrations/egovChain.js`.

## Compile with `evmVersion: paris` — not the default

Solidity 0.8.20 targets **Shanghai** by default, which emits the `PUSH0` (`0x5f`) opcode. The
hackathon Besu node predates Shanghai and rejects it: the deploy fails `eth_estimateGas` with

```
-32000 Transaction processing could not be completed due to an exception: INVALID_OPERATION
```

That error names no opcode and reads exactly like a permissioning refusal, which is the wrong
diagnosis — contract creation is *not* restricted on this chain. A minimal contract
(`0x60006000f3`) deploys fine, and that control is what separates the two explanations.

Recompiling with `evmVersion: "paris"` replaces `PUSH0` with `PUSH1 0x00` (bytecode 661 → 683
bytes) and the same deploy estimates cleanly. **Any redeploy must pin this**, or it produces
bytecode this chain silently refuses.

```js
settings: { evmVersion: 'paris', optimizer: { enabled: true, runs: 200 } }
```

## Verify a record end-to-end (staging)

1. `POST /records` with a lab payload — response includes `anchor.hash` and `anchor.txHash`.
2. Find `anchor.txHash` on the explorer.
3. `GET /records/:id/verify` → `verified: true`, `anchoredOnChain: true`.
4. Hand-edit the encrypted payload in Upstash and hit the same endpoint again → `verified: false`.
   That second half is the actual tamper-evidence proof, not the receipt round-trip.
