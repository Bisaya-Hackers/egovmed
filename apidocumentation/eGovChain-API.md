"# eGovChain API

Anchor records and run smart contracts on a zero-fee government blockchain (Hyperledger Besu) over JSON-RPC, for tamper-evident, verifiable state.

Postman Collection v2.1 for the DICT eGov hackathon Hyperledger Besu QBFT node.

- **Zero fees** — all transactions use `gasPrice: 0` (no ETH needed for gas).
- **RPC**: `https://hackathon-blockchain.e.gov.ph`
- **Chain ID**: 13371 (0x343b)
- **Explorer**: `https://hackathon-explorer.e.gov.ph`
- Operator-only APIs (ADMIN, DEBUG, TRACE) are not included; this collection covers ETH, NET, WEB3, TXPOOL, and read-only QBFT.
- Participants can deploy their own smart contracts to this chain using Remix, Hardhat, Foundry, MetaMask, or any Ethereum tooling pointed at the RPC above.

All requests are **POST** to `{{rpcUrl}}` with `Content-Type: application/json`, using the standard JSON-RPC 2.0 envelope:
```json
{ \"jsonrpc\": \"2.0\", \"method\": \"<method_name>\", \"params\": [...], \"id\": 1 }
```

## Calling Convention (worked example: rpc_modules)

### Misc / rpc_modules

**POST** `{{rpcUrl}}` — method: `rpc_modules`

Lists enabled JSON-RPC API namespaces on this Besu node.

Params: `[]`

Returns: Object mapping namespace → version (e.g. eth, net, web3).

Example cURL:
```bash
curl --request POST \
  --url '{{rpcUrl}}' \
  --header 'Content-Type: application/json' \
  --data '{ \"jsonrpc\": \"2.0\", \"method\": \"rpc_modules\", \"params\": [], \"id\": 1 }'
```

Example response (200 OK):
```json
{
  \"jsonrpc\": \"2.0\",
  \"id\": 1,
  \"result\": { \"txpool\": \"1.0\", \"trace\": \"1.0\", \"debug\": \"1.0\", \"eth\": \"1.0\", \"web3\": \"1.0\", \"admin\": \"1.0\", \"qbft\": \"1.0\", \"net\": \"1.0\" }
}
```

Every other Besu JSON-RPC method below follows this exact same calling convention: POST to `{{rpcUrl}}` with `method` set to the method name and the documented `params` array.

## Besu JSON-RPC Methods (by category)

### WEB3
- `web3_clientVersion` — returns the client version string.
- `web3_sha3` — returns Keccak-256 hash of the given data.

### NET
- `net_version` — returns the current network ID.
- `net_listening` — whether the client is actively listening for network connections.
- `net_peerCount` — number of peers currently connected.
- `net_enode` — the node's enode URI.
- `net_services` — information on running services (e.g. jsonrpc).

### ETH — chain / gas
- `eth_chainId` — returns the chain ID (13371 / 0x343b).
- `eth_protocolVersion` — the current Ethereum protocol version.
- `eth_syncing` — sync status (or `false` if not syncing).
- `eth_coinbase` — the client's coinbase address.
- `eth_mining` — whether the client is mining.
- `eth_hashrate` — current hashrate.
- `eth_gasPrice` — current gas price (always `0x0` on this zero-fee chain).
- `eth_maxPriorityFeePerGas` — suggested max priority fee per gas.
- `eth_feeHistory` — historical gas fee data.
- `eth_blobBaseFee` — current blob base fee.
- `eth_blockNumber` — number of the most recent block.

### ETH — accounts / state
- `eth_accounts` — list of addresses owned by the client.
- `eth_getBalance` — balance of an address (latest block).
- `eth_getBalance` (at block) — balance of an address at a specific block.
- `eth_getTransactionCount` — number of transactions sent from an address (nonce).
- `eth_getTransactionCount` (pending) — nonce including pending transactions.
- `eth_getCode` — runtime bytecode at an address (`0x` for EOAs).
- `eth_getStorageAt` — value from a storage position at an address.
- `eth_getProof` — Merkle proof for account and storage values.

### ETH — blocks
- `eth_getBlockByNumber` (latest) — block info by number, latest tag.
- `eth_getBlockByNumber` (full txs) — block info by number including full transaction objects.
- `eth_getBlockByHash` — block info by hash.
- `eth_getBlockTransactionCountByNumber` — number of transactions in a block by number.
- `eth_getBlockTransactionCountByHash` — number of transactions in a block by hash.
- `eth_getBlockReceipts` — all transaction receipts for a block.
- `eth_getUncleCountByBlockNumber` — number of uncles in a block by number.
- `eth_getUncleCountByBlockHash` — number of uncles in a block by hash.
- `eth_getUncleByBlockNumberAndIndex` — uncle block info by block number and index.

### ETH — transactions
- `eth_getTransactionByHash` — transaction info by hash.
- `eth_getTransactionReceipt` — transaction receipt by hash.
- `eth_getTransactionByBlockNumberAndIndex` — transaction info by block number and index.
- `eth_getTransactionByBlockHashAndIndex` — transaction info by block hash and index.
- `eth_sendRawTransaction` — submit a signed transaction.

### ETH — filters / logs
- `eth_newBlockFilter` — creates a filter for new blocks.
- `eth_newPendingTransactionFilter` — creates a filter for new pending transactions.
- `eth_newFilter` — creates a filter for logs matching given criteria.
- `eth_getFilterChanges` — polling method for changes on a filter.
- `eth_getFilterLogs` — all logs matching a filter.
- `eth_uninstallFilter` — removes a filter.
- `eth_getLogs` — logs matching given filter criteria (see Contract examples below for a worked example).

### ETH — call / estimate
- `eth_call` — executes a message call immediately without creating a transaction (simulation only, no state change).
- `eth_estimateGas` — estimates the gas needed for a transaction.
- `eth_createAccessList` — generates an EIP-2930 access list for a transaction.

### QBFT (read-only)
- `qbft_getValidatorsByBlockNumber` — list of validators at a given block number.
- `qbft_getValidatorsByBlockHash` — list of validators at a given block hash.
- `qbft_getPendingVotes` — pending validator votes.
- `qbft_getSignerMetrics` — signer/proposer metrics.

### TXPOOL
- `txpool_besuStatistics` — transaction pool statistics.
- `txpool_besuTransactions` — transactions currently in the pool.
- `txpool_besuPendingTransactions` — pending transactions in the pool.

Note: all of the above follow the same request/response shape as the `rpc_modules` worked example above (POST to `{{rpcUrl}}`, JSON-RPC 2.0 envelope with `method` and `params`, zero-fee chain so `eth_gasPrice` → `0x0`).

## Contracts — HackathonGuestbook (demo contract eth_call samples)

These endpoints demonstrate calling a pre-deployed sample \"HackathonGuestbook\" contract at `{{contractAddress_HackathonGuestbook}}` using standard `eth_call` / `eth_getCode` / `eth_estimateGas` / `eth_getLogs` methods (all POST to `{{rpcUrl}}`).

### eth_getCode (HackathonGuestbook)

Returns the runtime bytecode at the guestbook contract's address (`0x` for EOAs; bytecode otherwise).

Params:
```json
[\"{{contractAddress_HackathonGuestbook}}\", \"latest\"]
```

Example response (200 OK): `{ \"jsonrpc\": \"2.0\", \"id\": 1, \"result\": \"0x6080604052...\" }` (long contract bytecode hex string, truncated in the doc UI).

### eth_call — teamCount()

Simulates a call (no state change) to the guestbook's `teamCount()` function, selector `0x8caa0083`.

Params:
```json
[{ \"to\": \"{{contractAddress_HackathonGuestbook}}\", \"data\": \"0x8caa0083\" }, \"latest\"]
```

Example response (200 OK):
```json
{ \"jsonrpc\": \"2.0\", \"id\": 1, \"result\": \"0x0000000000000000000000000000000000000000000000000000000000000001\" }
```

### eth_call — listTeams()

Simulates a call to `listTeams()`, selector `0x0d1d8d6d`.

Params:
```json
[{ \"to\": \"{{contractAddress_HackathonGuestbook}}\", \"data\": \"0x0d1d8d6d\" }, \"latest\"]
```

Example response (200 OK): ABI-encoded return data hex (array of team structs), truncated in the doc UI (~274 additional chars beyond the head shown).

### eth_call — getTeam(0)

Simulates a call to `getTeam(0)`, selector `0x008e0f1b` + team id (`{{guestbookTeamIdHex}}`).

Params:
```json
[{ \"to\": \"{{contractAddress_HackathonGuestbook}}\", \"data\": \"0x008e0f1b{{guestbookTeamIdHex}}\" }, \"latest\"]
```

Example response (200 OK): ABI-encoded team struct hex, including an address (`0xce6eb51f790f63488670fce1f85dd88355c3c047`) and a timestamp field, truncated in the doc UI.

### eth_call — entryCount()

Simulates a call to `entryCount()`, selector `0x0cbb0f83`.

Params:
```json
[{ \"to\": \"{{contractAddress_HackathonGuestbook}}\", \"data\": \"0x0cbb0f83\" }, \"latest\"]
```

Example response (200 OK):
```json
{ \"jsonrpc\": \"2.0\", \"id\": 1, \"result\": \"0x0000000000000000000000000000000000000000000000000000000000000002\" }
```

### eth_call — getEntry(0)

Simulates a call to `getEntry(0)`, selector `0xbae78d7b` + entry id (`{{guestbookEntryIdHex}}`).

Params:
```json
[{ \"to\": \"{{contractAddress_HackathonGuestbook}}\", \"data\": \"0xbae78d7b{{guestbookEntryIdHex}}\" }, \"latest\"]
```

Example response (200 OK): ABI-encoded entry struct hex (including author address), truncated in the doc UI.

### eth_call — createTeam(\"Team Alpha\") — SIMULATION ONLY

Simulates (does not persist) a call to `createTeam(\"Team Alpha\")`, selector `0x972fa53f`. Use a wallet/signed transaction for real writes.

Params:
```json
[
  {
    \"from\": \"{{devAccount}}\",
    \"to\": \"{{contractAddress_HackathonGuestbook}}\",
    \"gas\": \"0x7a120\",
    \"gasPrice\": \"0x0\",
    \"data\": \"0x972fa53f0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000a5465616d20416c70686100000000000000000000000000000000000000000000\"
  },
  \"latest\"
]
```

Example response (200 OK):
```json
{ \"jsonrpc\": \"2.0\", \"id\": 1, \"result\": \"0x0000000000000000000000000000000000000000000000000000000000000001\" }
```

### eth_call — post(\"Hello hackathon!\") — SIMULATION ONLY

Simulates (does not persist) a call to `post(\"Hello hackathon!\")`, selector `0x8ee93cf3`.

Params:
```json
[
  {
    \"from\": \"{{devAccount}}\",
    \"to\": \"{{contractAddress_HackathonGuestbook}}\",
    \"gas\": \"0x7a120\",
    \"gasPrice\": \"0x0\",
    \"data\": \"0x8ee93cf30000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001048656c6c6f206861636b6174686f6e2100000000000000000000000000000000\"
  },
  \"latest\"
]
```

Example response (200 OK):
```json
{ \"jsonrpc\": \"2.0\", \"id\": 1, \"result\": \"0x0000000000000000000000000000000000000000000000000000000000000002\" }
```

### eth_call — postForTeam(0, \"Go Alpha!\") — SIMULATION ONLY

Simulates (does not persist) a call to `postForTeam(0, \"Go Alpha!\")`, selector `0x672d0bb4`.

Params:
```json
[
  {
    \"from\": \"{{devAccount}}\",
    \"to\": \"{{contractAddress_HackathonGuestbook}}\",
    \"gas\": \"0x7a120\",
    \"gasPrice\": \"0x0\",
    \"data\": \"0x672d0bb400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000009476f20416c706861210000000000000000000000000000000000000000000000\"
  },
  \"latest\"
]
```

Example response (200 OK):
```json
{ \"jsonrpc\": \"2.0\", \"id\": 1, \"result\": \"0x0000000000000000000000000000000000000000000000000000000000000002\" }
```

### eth_estimateGas — createTeam(\"Team Alpha\")

Estimates gas for the `createTeam(\"Team Alpha\")` calldata (same `data` as the createTeam eth_call sample above, without `gas` field).

Params:
```json
[
  {
    \"from\": \"{{devAccount}}\",
    \"to\": \"{{contractAddress_HackathonGuestbook}}\",
    \"gasPrice\": \"0x0\",
    \"data\": \"0x972fa53f0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000a5465616d20416c70686100000000000000000000000000000000000000000000\"
  }
]
```

Example response (200 OK):
```json
{ \"jsonrpc\": \"2.0\", \"id\": 1, \"result\": \"0x1d32f\" }
```

### eth_getLogs — TeamCreated events

Queries logs in a block range, filtered by the `TeamCreated` event's topic0. Uses `{{logsFromBlock}}` / `{{logsToBlock}}` (avoid `0x0`→`latest` ranges — keep ranges small since Besu enforces a max range).

Params:
```json
[
  {
    \"fromBlock\": \"{{logsFromBlock}}\",
    \"toBlock\": \"{{logsToBlock}}\",
    \"address\": \"{{contractAddress_HackathonGuestbook}}\",
    \"topics\": [\"0x31e53e620200526794090176a9f84c399de83e99e97f7e76485a3f2003087443\"]
  }
]
```

Example response (200 OK): array with one log entry, containing `blockNumber`, `blockHash`, `transactionHash`, `address` (`0x2012eff5594ba45ec8ec537b982dd18dc529ca95`), `data`, and `topics` (event signature topic0 plus indexed team id and creator address).

### eth_getLogs — MessagePosted events

Queries logs in a block range, filtered by the `MessagePosted` event's topic0.

Params:
```json
[
  {
    \"fromBlock\": \"{{logsFromBlock}}\",
    \"toBlock\": \"{{logsToBlock}}\",
    \"address\": \"{{contractAddress_HackathonGuestbook}}\",
    \"topics\": [\"0xb8addafd9d8559bac754e99668df214a10c9161e79b925a167b576e94e8469de\"]
  }
]
```

Example response (200 OK): array with two log entries, each containing `blockNumber`, `blockHash`, `transactionHash`, `address` (`0x2012eff5594ba45ec8ec537b982dd18dc529ca95`), `data`, and `topics` (event signature topic0 plus indexed entry id, author address, and team id).

## Scope Note

This document lists all 58 standard Besu JSON-RPC methods by name and category with the shared calling convention (worked example: `rpc_modules`), and provides full request/response detail for all 12 custom \"Contracts — HackathonGuestbook\" sample endpoints. Full individual parameter/response tables for every standard JSON-RPC method were not exhaustively captured (they follow the same JSON-RPC 2.0 request shape shown above); let the user know if per-method expansion is needed.
"