// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DocumentVerifier
 * @dev Stores and verifies document CIDs on-chain.
 *      The contract owner deploys it; any caller can register their own docs.
 *      Only the original issuer (or owner) can revoke a document.
 */
contract DocumentVerifier {

    

    struct Document {
        string  documentId;   // ID supplied by the user
        string  cid;          // IPFS
        address issuer;       // Wallet that registered the document
        uint256 timestamp;    // Block timestamp at registration
        bool    valid;        // false once revoked
    }

    

    address public owner;

    
    mapping(string => Document) private documents;

    

    event DocumentRegistered(
        string  indexed documentId,
        string  cid,
        address indexed issuer,
        uint256 timestamp
    );

    event DocumentRevoked(
        string  indexed documentId,
        address indexed revokedBy,
        uint256 timestamp
    );

    

    constructor() {
        owner = msg.sender;
    }

    

    modifier onlyOwner() {
        require(msg.sender == owner, "Not contract owner");
        _;
    }

    modifier documentExists(string memory documentId) {
        require(
            bytes(documents[documentId].cid).length > 0,
            "Document not found"
        );
        _;
    }

    

    /**
     * @notice Register a new document.
     * @param documentId  A unique string identifier chosen by the caller.
     * @param cid         The IPFS CID of the uploaded file.
     */
    function registerDocument(string memory documentId, string memory cid) external {
        // Prevent duplicate registration
        require(
            bytes(documents[documentId].cid).length == 0,
            "Document already registered"
        );

        require(bytes(documentId).length > 0, "Document ID cannot be empty");
        require(bytes(cid).length > 0, "CID cannot be empty");

        documents[documentId] = Document({
            documentId: documentId,
            cid:        cid,
            issuer:     msg.sender,
            timestamp:  block.timestamp,
            valid:      true
        });

        emit DocumentRegistered(documentId, cid, msg.sender, block.timestamp);
    }

    /**
     * @notice Verify whether a given CID matches the stored record and is valid.
     * @param documentId  The document identifier to look up.
     * @param cid         The CID to compare against the stored value.
     * @return isVerified True if the CID matches AND the document has not been revoked.
     */
    function verifyDocument(
        string memory documentId,
        string memory cid
    ) external view documentExists(documentId) returns (bool isVerified) {
        Document memory doc = documents[documentId];

        bool cidMatches = keccak256(bytes(doc.cid)) == keccak256(bytes(cid));
        return cidMatches && doc.valid;
    }

    /**
     * @notice Retrieve full document details.
     * @param documentId  The document identifier to look up.
     */
    function getDocument(string memory documentId)
        external
        view
        documentExists(documentId)
        returns (
            string  memory docId,
            string  memory cid,
            address issuer,
            uint256 timestamp,
            bool    valid
        )
    {
        Document memory doc = documents[documentId];
        return (doc.documentId, doc.cid, doc.issuer, doc.timestamp, doc.valid);
    }

    /**
     * @notice Revoke a document so it can no longer be verified.
     *         Only the original issuer or the contract owner may revoke.
     * @param documentId  The document to revoke.
     */
    function revokeDocument(string memory documentId)
        external
        documentExists(documentId)
    {
        Document storage doc = documents[documentId];

        require(
            msg.sender == doc.issuer || msg.sender == owner,
            "Not authorized to revoke"
        );
        require(doc.valid, "Document already revoked");

        doc.valid = false;

        emit DocumentRevoked(documentId, msg.sender, block.timestamp);
    }
}
