/**
 * web3.js — MetaMask + ethers.js v6 integration for TrueDocs.
 *
 * Handles:
 *   - Wallet connection via window.ethereum
 *   - Network detection (Hardhat chainId 31337)
 *   - Account/network change listeners
 *   - Smart contract interaction via ethers v6 BrowserProvider
 */

import { BrowserProvider, Contract, formatEther } from "ethers";
import contractABI from "../abi/DocumentVerifier.json";

// ── Config (fetched from backend at runtime) ──────────────────────────────────
let _contractAddress = null;
let _requiredChainId = 31337n;       // Hardhat localhost default
let _requiredChainHex = "0x7a69";   // 31337 in hex

export async function fetchBlockchainConfig() {
  try {
    const resp = await fetch("/api/public/blockchain-config");
    const cfg = await resp.json();
    if (cfg.contract_address) _contractAddress = cfg.contract_address;
    if (cfg.chain_id) {
      _requiredChainId = BigInt(cfg.chain_id);
      _requiredChainHex = "0x" + cfg.chain_id.toString(16);
    }
    return cfg;
  } catch {
    // Fallback to defaults
    return { contract_address: _contractAddress, chain_id: Number(_requiredChainId) };
  }
}

export function getContractAddress() { return _contractAddress; }
export function getRequiredChainId() { return _requiredChainId; }
export function getRequiredChainHex() { return _requiredChainHex; }

// ── MetaMask detection ────────────────────────────────────────────────────────

export function isMetaMaskInstalled() {
  return typeof window !== "undefined" && typeof window.ethereum !== "undefined";
}

// ── Wallet connection ──────────────────────────────────────────────────────────

/**
 * Connect to MetaMask and return { provider, signer, address, chainId }.
 * Throws descriptive errors for all failure cases.
 */
export async function connectWallet() {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed. Please install the MetaMask browser extension.");
  }

  let accounts;
  try {
    accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  } catch (err) {
    if (err.code === 4001) {
      throw new Error("Connection request rejected. Please approve the MetaMask connection.");
    }
    throw new Error(`MetaMask connection failed: ${err.message || err}`);
  }

  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts returned from MetaMask.");
  }

  const provider = new BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return {
    provider,
    signer,
    address,
    chainId: network.chainId,
    networkName: _networkName(network.chainId),
  };
}

/**
 * Get the current wallet state without requesting connection (no popup).
 */
export async function getWalletState() {
  if (!isMetaMaskInstalled()) {
    return { installed: false, connected: false };
  }

  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  if (!accounts || accounts.length === 0) {
    return { installed: true, connected: false };
  }

  const provider = new BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const balance = await provider.getBalance(address);

  return {
    installed: true,
    connected: true,
    address,
    chainId: network.chainId,
    networkName: _networkName(network.chainId),
    balance: formatEther(balance),
  };
}

// ── Network helpers ───────────────────────────────────────────────────────────

export function isCorrectNetwork(chainId) {
  return BigInt(chainId) === _requiredChainId;
}

/**
 * Request MetaMask to switch to the required network.
 * For Hardhat localhost, the user must have it pre-configured in MetaMask.
 */
export async function switchNetwork() {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed.");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: _requiredChainHex }],
    });
  } catch (err) {
    // chainId 4902 = chain not added to MetaMask
    if (err.code === 4902) {
      throw new Error(
        `Network not found in MetaMask. Please add a custom network:\n` +
        `  Chain ID: ${Number(_requiredChainId)}\n` +
        `  RPC URL: http://127.0.0.1:8545\n` +
        `  Currency: ETH`
      );
    }
    throw new Error(`Failed to switch network: ${err.message || err}`);
  }
}

// ── Contract interaction ──────────────────────────────────────────────────────

/**
 * Get a contract instance connected to the given signer.
 */
export function getContract(signer) {
  if (!_contractAddress) {
    throw new Error("Contract address not configured. Call fetchBlockchainConfig() first.");
  }
  return new Contract(_contractAddress, contractABI, signer);
}

/**
 * Register a document on the blockchain via MetaMask.
 * Returns { tx_hash, waitPromise } — caller should await waitPromise for confirmation.
 *
 * @param {ethers.Signer} signer   - The org's MetaMask signer
 * @param {string} documentId      - SHA-256 hash of the document
 * @param {string} cid             - IPFS CID from Pinata
 */
export async function registerDocumentOnChain(signer, documentId, cid) {
  const contract = getContract(signer);
  const tx = await contract.registerDocument(documentId, cid);
  return {
    txHash: tx.hash,
    wait: tx.wait(),  // Promise that resolves when tx is mined
  };
}

/**
 * Get a read-only contract instance (no signer needed).
 */
export function getReadContract(provider) {
  if (!_contractAddress) {
    throw new Error("Contract address not configured.");
  }
  return new Contract(_contractAddress, contractABI, provider);
}

// ── Event listeners ────────────────────────────────────────────────────────────

export function onAccountsChanged(callback) {
  if (!isMetaMaskInstalled()) return () => {};
  const handler = (accounts) => callback(accounts);
  window.ethereum.on("accountsChanged", handler);
  return () => window.ethereum.removeListener("accountsChanged", handler);
}

export function onChainChanged(callback) {
  if (!isMetaMaskInstalled()) return () => {};
  const handler = (chainId) => callback(chainId);
  window.ethereum.on("chainChanged", handler);
  return () => window.ethereum.removeListener("chainChanged", handler);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _networkName(chainId) {
  const id = BigInt(chainId);
  const names = {
    1n: "Ethereum Mainnet",
    11155111n: "Sepolia Testnet",
    31337n: "Hardhat Local",
    1337n: "Localhost",
  };
  return names[id] || `Chain ${id}`;
}

export function shortAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
