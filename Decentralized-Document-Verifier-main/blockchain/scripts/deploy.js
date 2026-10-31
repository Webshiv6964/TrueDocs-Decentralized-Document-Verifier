/**
 * deploy.js
 *
 * Deploys the DocumentVerifier contract.
 *
 * Usage:
 *   Local node  →  npx hardhat run scripts/deploy.js --network localhost
 *   In-process  →  npx hardhat run scripts/deploy.js
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("─────────────────────────────────────────");
  console.log("  Deploying DocumentVerifier contract...");
  console.log("─────────────────────────────────────────");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer address : ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance : ${ethers.formatEther(balance)} ETH`);

  // Deploy
  const DocumentVerifier = await ethers.getContractFactory("DocumentVerifier");
  const contract = await DocumentVerifier.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();

  console.log("─────────────────────────────────────────");
  console.log(`✓ Contract deployed at: ${contractAddress}`);
  console.log("─────────────────────────────────────────");

  // ── Write deployment info for the backend ────────────────────────────────
  // Copies the ABI to backend/abi/DocumentVerifier.json and prints .env values

  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/DocumentVerifier.sol/DocumentVerifier.json"
  );

  // The ABI file path in the backend folder
  const abiOutputDir  = path.join(__dirname, "../../backend/abi");
  const abiOutputPath = path.join(abiOutputDir, "DocumentVerifier.json");

  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    // Create the backend/abi directory if it doesn't exist yet
    if (!fs.existsSync(abiOutputDir)) {
      fs.mkdirSync(abiOutputDir, { recursive: true });
    }

    // Write only the ABI (not the full artifact) to keep the file small
    fs.writeFileSync(
      abiOutputPath,
      JSON.stringify({ abi: artifact.abi }, null, 2)
    );

    console.log(`✓ ABI written to: backend/abi/DocumentVerifier.json`);
  } else {
    console.log(
      "⚠  Artifact not found. Run 'npx hardhat compile' first, then re-deploy."
    );
  }

  // Print the values the backend developer needs to put in .env
  console.log("\nAdd these to your backend/.env file:");
  console.log(`CONTRACT_ADDRESS=${contractAddress}`);
  console.log(`RPC_URL=http://127.0.0.1:8545`);
  console.log("─────────────────────────────────────────\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
