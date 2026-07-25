// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title RecordAnchor
 * @notice Tamper-evidence anchor for eGovMed health records on eGovChain (Hyperledger Besu QBFT).
 *
 * Only the sha256 fingerprint of an off-chain, encrypted health record is ever written on-chain.
 * No PHI, no patient identifiers, no clinical content — this is a Data Privacy Act 2012 hard requirement
 * (see egovChain.js `anchorLive` which strips metadata down to a record-type tag before submitting).
 *
 * Verification model:
 *   1. Backend recomputes the sha256 fingerprint from the current off-chain data at verify time.
 *   2. Backend calls `anchoredAt(hash)` — a non-zero return proves the same hash was anchored on-chain.
 *   3. If (1) matches (2) → the off-chain record is untampered since it was created.
 *
 * The first `anchor(...)` for a given hash is authoritative. Subsequent anchors of the same hash
 * are no-ops (they emit the event for auditability but preserve the original timestamp), so the
 * verified timestamp reflects the moment of first anchoring, not the most recent write.
 */
contract RecordAnchor {
    // hash → block timestamp of first anchoring (0 means never anchored)
    mapping(bytes32 => uint256) private _anchoredAt;
    // hash → address that first anchored it (audit trail; not used for verification)
    mapping(bytes32 => address) private _submitter;

    event Anchored(bytes32 indexed recordHash, address indexed submitter, uint256 timestamp);
    event ReAnchorAttempted(bytes32 indexed recordHash, address indexed submitter);

    /**
     * @notice Anchor a record hash. Returns true on first-time anchor, false if already anchored.
     * @dev `metadata` is intentionally free-form JSON but MUST NOT contain PHI or identifiers.
     *      The backend only writes `{type, anchoredAt}` — see egovChain.js `anchorLive`.
     */
    function anchor(bytes32 recordHash, string calldata metadata) external returns (bool) {
        // silence unused-param warning without dropping the ABI arg
        metadata;
        if (_anchoredAt[recordHash] != 0) {
            emit ReAnchorAttempted(recordHash, msg.sender);
            return false;
        }
        _anchoredAt[recordHash] = block.timestamp;
        _submitter[recordHash] = msg.sender;
        emit Anchored(recordHash, msg.sender, block.timestamp);
        return true;
    }

    /**
     * @notice Read the block timestamp at which `recordHash` was first anchored.
     * @return timestamp Unix seconds of the first anchoring, or 0 if never anchored.
     *         This is the function `verifyAnchor` in the backend calls via eth_call.
     */
    function anchoredAt(bytes32 recordHash) external view returns (uint256) {
        return _anchoredAt[recordHash];
    }

    /**
     * @notice Read the address that first anchored `recordHash`.
     * @return submitter Address of the first anchor caller, or address(0) if never anchored.
     */
    function submitterOf(bytes32 recordHash) external view returns (address) {
        return _submitter[recordHash];
    }

    /**
     * @notice Convenience predicate for callers that only need a boolean.
     */
    function isAnchored(bytes32 recordHash) external view returns (bool) {
        return _anchoredAt[recordHash] != 0;
    }
}
