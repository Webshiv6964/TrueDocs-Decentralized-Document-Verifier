require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    // Default in-process Hardhat network (used for tests)
    hardhat: {},

    // Local node started with: npx hardhat node
    localhost: {
      url: "http://127.0.0.1:8545",
    },

    // Uncomment and fill in to deploy to a public testnet (e.g. Sepolia)
    // sepolia: {
    //   url: process.env.RPC_URL || "",
    //   accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    // },
  },

  // Paths (defaults shown for clarity)
  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
