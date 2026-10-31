/**
 * DocumentVerifier.test.js
 *
 * Test suite for the DocumentVerifier smart contract.
 * Run with:  npx hardhat test
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DocumentVerifier", function () {
  let contract;
  let owner;
  let otherUser;

  // Sample document data
  const DOC_ID  = "DOC001";
  const CID     = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
  const FAKE_CID = "bafyFAKECID1234567890abcdefghijklmnopqrstuvwxyz";

  // Deploy a fresh contract before every test
  beforeEach(async function () {
    [owner, otherUser] = await ethers.getSigners();
    const DocumentVerifier = await ethers.getContractFactory("DocumentVerifier");
    contract = await DocumentVerifier.deploy();
    await contract.waitForDeployment();
  });

  // ── Deployment ──────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("should set the deployer as owner", async function () {
      expect(await contract.owner()).to.equal(owner.address);
    });
  });

  // ── registerDocument ────────────────────────────────────────────────────

  describe("registerDocument", function () {
    it("should register a document and emit DocumentRegistered event", async function () {
      await expect(contract.registerDocument(DOC_ID, CID))
        .to.emit(contract, "DocumentRegistered")
        .withArgs(DOC_ID, CID, owner.address, await latestTimestamp());
    });

    it("should store the document with valid = true", async function () {
      await contract.registerDocument(DOC_ID, CID);
      const [docId, cid, issuer, , valid] = await contract.getDocument(DOC_ID);

      expect(docId).to.equal(DOC_ID);
      expect(cid).to.equal(CID);
      expect(issuer).to.equal(owner.address);
      expect(valid).to.equal(true);
    });

    it("should revert if the same document ID is registered twice", async function () {
      await contract.registerDocument(DOC_ID, CID);
      await expect(contract.registerDocument(DOC_ID, CID))
        .to.be.revertedWith("Document already registered");
    });

    it("should revert if document ID is empty", async function () {
      await expect(contract.registerDocument("", CID))
        .to.be.revertedWith("Document ID cannot be empty");
    });

    it("should revert if CID is empty", async function () {
      await expect(contract.registerDocument(DOC_ID, ""))
        .to.be.revertedWith("CID cannot be empty");
    });

    it("should allow different users to register different documents", async function () {
      await contract.connect(owner).registerDocument("DOC001", CID);
      await contract.connect(otherUser).registerDocument("DOC002", CID);

      const [, , issuer1] = await contract.getDocument("DOC001");
      const [, , issuer2] = await contract.getDocument("DOC002");

      expect(issuer1).to.equal(owner.address);
      expect(issuer2).to.equal(otherUser.address);
    });
  });

  // ── verifyDocument ──────────────────────────────────────────────────────

  describe("verifyDocument", function () {
    beforeEach(async function () {
      await contract.registerDocument(DOC_ID, CID);
    });

    it("should return true for a correct CID", async function () {
      const result = await contract.verifyDocument(DOC_ID, CID);
      expect(result).to.equal(true);
    });

    it("should return false for an incorrect CID", async function () {
      const result = await contract.verifyDocument(DOC_ID, FAKE_CID);
      expect(result).to.equal(false);
    });

    it("should revert when the document ID does not exist", async function () {
      await expect(contract.verifyDocument("NONEXISTENT", CID))
        .to.be.revertedWith("Document not found");
    });
  });

  // ── getDocument ─────────────────────────────────────────────────────────

  describe("getDocument", function () {
    it("should return correct document details", async function () {
      await contract.registerDocument(DOC_ID, CID);
      const [docId, cid, issuer, timestamp, valid] = await contract.getDocument(DOC_ID);

      expect(docId).to.equal(DOC_ID);
      expect(cid).to.equal(CID);
      expect(issuer).to.equal(owner.address);
      expect(timestamp).to.be.gt(0);
      expect(valid).to.equal(true);
    });

    it("should revert for a non-existent document", async function () {
      await expect(contract.getDocument("GHOST"))
        .to.be.revertedWith("Document not found");
    });
  });

  // ── revokeDocument ──────────────────────────────────────────────────────

  describe("revokeDocument", function () {
    beforeEach(async function () {
      await contract.registerDocument(DOC_ID, CID);
    });

    it("should allow the issuer to revoke their document", async function () {
      await expect(contract.revokeDocument(DOC_ID))
        .to.emit(contract, "DocumentRevoked")
        .withArgs(DOC_ID, owner.address, await latestTimestamp());
    });

    it("should set valid to false after revocation", async function () {
      await contract.revokeDocument(DOC_ID);
      const [, , , , valid] = await contract.getDocument(DOC_ID);
      expect(valid).to.equal(false);
    });

    it("should return false on verify after revocation", async function () {
      await contract.revokeDocument(DOC_ID);
      const result = await contract.verifyDocument(DOC_ID, CID);
      expect(result).to.equal(false);
    });

    it("should allow the contract owner to revoke any document", async function () {
      // otherUser registers a document
      await contract.connect(otherUser).registerDocument("DOC002", CID);
      // owner revokes it
      await expect(contract.connect(owner).revokeDocument("DOC002"))
        .to.emit(contract, "DocumentRevoked");
    });

    it("should revert if a non-issuer / non-owner tries to revoke", async function () {
      await expect(contract.connect(otherUser).revokeDocument(DOC_ID))
        .to.be.revertedWith("Not authorized to revoke");
    });

    it("should revert if the document is already revoked", async function () {
      await contract.revokeDocument(DOC_ID);
      await expect(contract.revokeDocument(DOC_ID))
        .to.be.revertedWith("Document already revoked");
    });

    it("should revert for a non-existent document", async function () {
      await expect(contract.revokeDocument("GHOST"))
        .to.be.revertedWith("Document not found");
    });
  });
});

// ── Helper ───────────────────────────────────────────────────────────────────

async function latestTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}
