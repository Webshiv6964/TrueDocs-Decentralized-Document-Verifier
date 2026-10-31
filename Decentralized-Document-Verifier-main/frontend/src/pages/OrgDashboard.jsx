import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  orgMe, orgDocuments,
  getWalletNonce, linkWallet,
  prepareDocument, confirmDocument,
} from "../services/api";
import {
  isMetaMaskInstalled, connectWallet, getWalletState,
  onAccountsChanged, onChainChanged,
  isCorrectNetwork, switchNetwork, shortAddress,
  fetchBlockchainConfig, getRequiredChainId,
  registerDocumentOnChain,
} from "../services/web3";

const MAX_SIZE = 20 * 1024 * 1024;

function fmt(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}
function shortHash(h) {
  if (!h) return "";
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

const TX_STATUS = {
  IDLE:             "idle",
  UPLOADING_IPFS:   "uploading_ipfs",
  WAITING_METAMASK: "waiting_metamask",
  TX_SUBMITTED:     "tx_submitted",
  TX_PROCESSING:    "tx_processing",
  CONFIRMING:       "confirming",
  CONFIRMED:        "confirmed",
  FAILED:           "failed",
};

const TX_LABELS = {
  [TX_STATUS.IDLE]:             "",
  [TX_STATUS.UPLOADING_IPFS]:   "Uploading to IPFS…",
  [TX_STATUS.WAITING_METAMASK]: "Waiting for MetaMask confirmation…",
  [TX_STATUS.TX_SUBMITTED]:     "Transaction submitted…",
  [TX_STATUS.TX_PROCESSING]:    "Mining transaction…",
  [TX_STATUS.CONFIRMING]:       "Verifying on backend…",
  [TX_STATUS.CONFIRMED]:        "Registration confirmed!",
  [TX_STATUS.FAILED]:           "Registration failed",
};

export default function OrgDashboard() {
  const { orgInfo } = useAuth();

  const [profile,  setProfile]  = useState(null);
  const [docs,     setDocs]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // ── Wallet state ──────────────────────────────────────────────────────────────
  const [walletInstalled,  setWalletInstalled]  = useState(false);
  const [walletAddress,    setWalletAddress]    = useState(null);
  const [walletChainId,    setWalletChainId]    = useState(null);
  const [walletNetwork,    setWalletNetwork]    = useState("");
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletError,      setWalletError]      = useState("");

  /*
   * walletLinked tracks whether the CURRENTLY CONNECTED address has been
   * verified via a nonce signature and stored in the DB.
   *
   * Key change from the previous version:
   *   OLD: walletLinked = (dbWallet === connectedAddress)  ← caused the mismatch error
   *   NEW: walletLinked = (connectedAddress was signed + stored this session OR
   *                        connectedAddress matches what is already in the DB)
   *
   * We no longer block registration just because the addresses differ.
   * If the user connects a new/different account they can re-link it in one click.
   */
  const [linkedWallet,  setLinkedWallet]  = useState(null);  // address stored in DB
  const [linkingWallet, setLinkingWallet] = useState(false);

  // ── Registration state ────────────────────────────────────────────────────────
  const [file,      setFile]      = useState(null);
  const [fileErr,   setFileErr]   = useState("");
  const [txStatus,  setTxStatus]  = useState(TX_STATUS.IDLE);
  const [txError,   setTxError]   = useState("");
  const [regResult, setRegResult] = useState(null);
  const [dragging,  setDragging]  = useState(false);
  const inputRef = useRef(null);

  const acceptFile = useCallback((f) => {
    setFileErr("");
    if (!f) return;
    if (f.size > MAX_SIZE) { setFileErr("File must be under 20 MB."); return; }
    setFile(f);
  }, []);

  const loadData = async () => {
    setLoading(true); setError("");
    try {
      const [p, d] = await Promise.all([orgMe(), orgDocuments()]);
      setProfile(p);
      setLinkedWallet(p.wallet_address?.toLowerCase() || null);
      setDocs(d.documents || []);
    } catch (e) {
      setError(e.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  // ── Init ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchBlockchainConfig();
    setWalletInstalled(isMetaMaskInstalled());
    if (isMetaMaskInstalled()) {
      getWalletState().then((s) => {
        if (s.connected) {
          setWalletAddress(s.address.toLowerCase());
          setWalletChainId(s.chainId);
          setWalletNetwork(s.networkName);
        }
      }).catch(() => {});
    }
    loadData();
  }, []);

  // ── MetaMask event listeners ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isMetaMaskInstalled()) return;

    // When the user switches accounts in MetaMask, update immediately.
    // We do NOT reset linkedWallet here — the user can re-link the new address
    // with a single click if needed.
    const offAccounts = onAccountsChanged((accounts) => {
      if (accounts.length === 0) {
        setWalletAddress(null);
        setWalletError("");
      } else {
        setWalletAddress(accounts[0].toLowerCase());
        setWalletError(""); // clear any stale errors
      }
    });

    const offChain = onChainChanged((chainIdHex) => {
      setWalletChainId(BigInt(chainIdHex));
      getWalletState()
        .then((s) => s.connected && setWalletNetwork(s.networkName))
        .catch(() => {});
    });

    return () => { offAccounts(); offChain(); };
  }, []);

  // ── Connect wallet handler ────────────────────────────────────────────────────
  const handleConnectWallet = async () => {
    setWalletConnecting(true); setWalletError("");
    try {
      const result = await connectWallet();
      setWalletAddress(result.address.toLowerCase());
      setWalletChainId(result.chainId);
      setWalletNetwork(result.networkName);
    } catch (err) {
      setWalletError(err.message || "Failed to connect wallet.");
    } finally {
      setWalletConnecting(false);
    }
  };

  // ── Link wallet handler ───────────────────────────────────────────────────────
  // Signs a backend-issued nonce with the CURRENTLY CONNECTED address to prove
  // ownership, then stores that address in the DB.
  // This works for ANY account — normal, newly created, or imported.
  const handleLinkWallet = async () => {
    if (!walletAddress) { setWalletError("Connect your wallet first."); return; }
    setLinkingWallet(true); setWalletError("");
    try {
      // Step 1: get a fresh nonce from the backend
      const { nonce, message } = await getWalletNonce();

      // Step 2: ask MetaMask to sign it with the currently selected account
      const signature = await window.ethereum.request({
        method: "personal_sign",
        params: [message, walletAddress],
      });

      // Step 3: backend verifies signature → stores walletAddress → returns success
      const result = await linkWallet(walletAddress, signature);
      const stored = result.wallet_address.toLowerCase();
      setLinkedWallet(stored);

      // Refresh profile so the displayed linked address is up to date
      const p = await orgMe();
      setProfile(p);
      setLinkedWallet(p.wallet_address?.toLowerCase() || stored);
    } catch (err) {
      if (err.code === 4001 || err.message?.includes("rejected")) {
        setWalletError("Signature rejected. Please sign the message to link your wallet.");
      } else {
        setWalletError(err.message || "Failed to link wallet.");
      }
    } finally {
      setLinkingWallet(false);
    }
  };

  const handleSwitchNetwork = async () => {
    try { await switchNetwork(); }
    catch (err) { setWalletError(err.message); }
  };

  // ── Registration handler ──────────────────────────────────────────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!file) { setFileErr("Please select a file."); return; }

    if (!walletAddress) {
      setTxError("Please connect your MetaMask wallet first.");
      setTxStatus(TX_STATUS.FAILED); return;
    }

    // A wallet must have been linked (signed + verified) before registration.
    // The linked address does NOT have to equal the currently connected address —
    // the backend will update it automatically during confirm.
    if (!linkedWallet) {
      setTxError("Please link your wallet first by clicking \"Link Wallet\".");
      setTxStatus(TX_STATUS.FAILED); return;
    }

    if (!isCorrectNetwork(walletChainId)) {
      setTxError(`Wrong network. Switch to Hardhat Local (Chain ID ${getRequiredChainId()}).`);
      setTxStatus(TX_STATUS.FAILED); return;
    }

    setTxError(""); setRegResult(null); setTxStatus(TX_STATUS.UPLOADING_IPFS);

    let ipfsData = null;
    try {
      // Phase 1 — IPFS upload via backend
      ipfsData = await prepareDocument(file);

      // Phase 2 — MetaMask transaction using the CURRENTLY connected account
      setTxStatus(TX_STATUS.WAITING_METAMASK);
      const { BrowserProvider } = await import("ethers");
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      // getSigner() always gives the currently selected MetaMask account,
      // regardless of what address is stored in the DB.
      const signerAddress = (await signer.getAddress()).toLowerCase();

      const { txHash, wait } = await registerDocumentOnChain(
        signer, ipfsData.doc_hash, ipfsData.cid
      );
      setTxStatus(TX_STATUS.TX_SUBMITTED);

      // Phase 3 — wait for mining
      setTxStatus(TX_STATUS.TX_PROCESSING);
      await wait;

      // Phase 4 — backend verifies the tx and stores the record
      setTxStatus(TX_STATUS.CONFIRMING);
      const result = await confirmDocument(
        txHash,
        ipfsData.doc_hash,
        ipfsData.cid,
        ipfsData.ipfs_url,
        ipfsData.original_filename,
        signerAddress,   // tell backend which address actually signed this tx
      );

      setRegResult(result);
      setTxStatus(TX_STATUS.CONFIRMED);

      // Update linkedWallet to the address that just transacted, so the UI
      // shows "linked" without requiring a separate link step next time.
      setLinkedWallet(signerAddress);

      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      const d = await orgDocuments();
      setDocs(d.documents || []);

    } catch (err) {
      setTxStatus(TX_STATUS.FAILED);
      if (err.code === 4001 || err.message?.includes("rejected") || err.message?.includes("User denied")) {
        setTxError(
          ipfsData
            ? "Transaction rejected in MetaMask. Your file is already on IPFS — you can try again with the same file."
            : "Connection rejected in MetaMask."
        );
      } else if (err.message?.includes("insufficient funds")) {
        setTxError("Insufficient gas in your wallet. Fund it with test ETH from the Hardhat node.");
      } else if (err.reason) {
        setTxError(`Smart contract error: ${err.reason}`);
      } else {
        setTxError(err.message || "Registration failed. Please try again.");
      }
    }
  };

  const handleResetTx = () => { setTxStatus(TX_STATUS.IDLE); setTxError(""); setRegResult(null); };

  if (loading) {
    return (
      <div className="page-padded" style={{ textAlign: "center" }}>
        <span className="spinner spinner-lg" style={{ color: "var(--color-brand-400)" }} />
        <p style={{ marginTop: "var(--space-4)", color: "var(--dark-text-secondary)" }}>Loading dashboard…</p>
      </div>
    );
  }

  // ── Derived display state ─────────────────────────────────────────────────────
  const wrongNetwork    = walletAddress && !isCorrectNetwork(walletChainId);
  // currentWalletIsLinked = the connected address matches what's in the DB
  const currentWalletIsLinked = linkedWallet && walletAddress && linkedWallet === walletAddress;
  // canRegister: wallet connected + any wallet was ever linked + correct network + file chosen
  const canRegister = walletAddress && linkedWallet && !wrongNetwork && file;
  const isRegistering = txStatus !== TX_STATUS.IDLE && txStatus !== TX_STATUS.CONFIRMED && txStatus !== TX_STATUS.FAILED;

  return (
    <div className="page-padded">
      <div className="container">

        {error && (
          <div className="alert alert--error" role="alert" style={{ marginBottom: "var(--space-6)" }}>
            <div className="alert-body">{error}</div>
            <button className="alert-close" onClick={() => setError("")}>✕</button>
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: "var(--space-10)" }}>
          <div className="page-eyebrow">Organization Dashboard</div>
          <h1 className="page-title">{profile?.org_name || orgInfo?.org_name}</h1>
          <p style={{ color: "var(--dark-text-secondary)", fontSize: "var(--text-sm)" }}>
            {profile?.email} · Joined{" "}
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
          </p>
          <span className="badge badge--valid" style={{ marginTop: "var(--space-2)" }}>
            <span className="badge-dot" /> APPROVED
          </span>
        </div>

        {/* ── Wallet Panel ─────────────────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: "var(--space-10)", padding: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-4)" }}>

            {/* Status display */}
            <div>
              <h2 style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-2)" }}>
                🔗 MetaMask Wallet
              </h2>

              {!walletInstalled ? (
                <p style={{ color: "var(--color-error-500)", fontSize: "var(--text-sm)" }}>
                  MetaMask is not installed.{" "}
                  <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="result-link">
                    Install MetaMask ↗
                  </a>
                </p>
              ) : !walletAddress ? (
                <p style={{ color: "var(--dark-text-tertiary)", fontSize: "var(--text-sm)" }}>
                  Wallet not connected
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <span className="badge badge--valid">
                      <span className="badge-dot" /> Connected
                    </span>
                    <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", color: "var(--color-brand-300)" }}>
                      {shortAddress(walletAddress)}
                    </code>
                  </div>
                  <span style={{ fontSize: "var(--text-xs)", color: wrongNetwork ? "var(--color-error-500)" : "var(--dark-text-tertiary)" }}>
                    Network: {walletNetwork || "Unknown"}{wrongNetwork && " ⚠ (wrong network)"}
                  </span>

                  {/* Wallet link status — no "mismatch" warning, just a prompt to link */}
                  {!linkedWallet ? (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-warning-500)" }}>
                      ⚠ No wallet linked yet — click "Link Wallet" to continue
                    </span>
                  ) : currentWalletIsLinked ? (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success-500)" }}>
                      ✓ Wallet linked to your account
                    </span>
                  ) : (
                    // Different account selected — user can re-link or just proceed
                    // (the backend will accept any signed tx and update the linked address)
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--dark-text-tertiary)" }}>
                      Using a different account from last session — click "Re-link" to update, or register directly.
                    </span>
                  )}

                  {linkedWallet && !currentWalletIsLinked && (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--dark-text-tertiary)" }}>
                      Last linked: <code style={{ fontFamily: "var(--font-mono)" }}>{shortAddress(linkedWallet)}</code>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
              {!walletInstalled ? null : !walletAddress ? (
                <button className="btn btn-primary btn-sm" onClick={handleConnectWallet} disabled={walletConnecting}>
                  {walletConnecting ? <><span className="spinner spinner-sm" /> Connecting…</> : "Connect Wallet"}
                </button>
              ) : (
                // Show "Link Wallet" if no wallet is linked yet,
                // or "Re-link" if a different account is selected.
                // Either way the action is the same — sign a nonce with the current address.
                <button className="btn btn-secondary btn-sm" onClick={handleLinkWallet} disabled={linkingWallet}>
                  {linkingWallet
                    ? <><span className="spinner spinner-sm" /> Linking…</>
                    : !linkedWallet ? "Link Wallet" : currentWalletIsLinked ? "Re-link" : "Link This Account"
                  }
                </button>
              )}
              {wrongNetwork && (
                <button className="btn btn-secondary btn-sm" onClick={handleSwitchNetwork}>
                  Switch Network
                </button>
              )}
            </div>
          </div>

          {walletError && (
            <div className="alert alert--error" role="alert" style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
              <div className="alert-body" style={{ fontSize: "var(--text-sm)" }}>{walletError}</div>
              <button className="alert-close" onClick={() => setWalletError("")}>✕</button>
            </div>
          )}

          {wrongNetwork && (
            <div className="alert alert--warning" style={{ marginTop: "var(--space-4)", marginBottom: 0 }}>
              <div className="alert-body" style={{ fontSize: "var(--text-sm)" }}>
                Wrong network. TrueDocs requires <strong>Hardhat Local</strong> (Chain ID{" "}
                {getRequiredChainId().toString()}). Click "Switch Network" to change.
              </div>
            </div>
          )}
        </div>

        {/* ── Main content grid ───────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "var(--space-10)", alignItems: "start" }}>

          {/* ── Register Document ─────────────────────────────────────────────── */}
          <section>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "var(--space-5)" }}>
              Register a Document
            </h2>

            {/* Success */}
            {regResult && txStatus === TX_STATUS.CONFIRMED && (
              <div className="alert alert--success" role="status" style={{ marginBottom: "var(--space-4)" }}>
                <div className="alert-body">
                  <strong>✓ Registered on Blockchain!</strong>
                  <br />SHA-256: <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>{shortHash(regResult.doc_hash)}</code>
                  <br />Tx: <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>{shortHash(regResult.tx_hash)}</code>
                  <br />Issuer: <code style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)" }}>{shortAddress(regResult.issuer)}</code>
                  {regResult.block_number && <><br />Block: {regResult.block_number} · Gas: {regResult.gas_used}</>}
                  {regResult.ipfs_url && (
                    <><br /><a href={regResult.ipfs_url} target="_blank" rel="noopener noreferrer" className="result-link">View on IPFS ↗</a></>
                  )}
                </div>
                <button className="alert-close" onClick={handleResetTx}>✕</button>
              </div>
            )}

            {/* Error */}
            {txError && txStatus === TX_STATUS.FAILED && (
              <div className="alert alert--error" role="alert" style={{ marginBottom: "var(--space-4)" }}>
                <div className="alert-body" style={{ whiteSpace: "pre-wrap" }}>{txError}</div>
                <button className="alert-close" onClick={handleResetTx}>✕</button>
              </div>
            )}

            {/* Progress */}
            {isRegistering && (
              <div className="card" style={{ marginBottom: "var(--space-4)", padding: "var(--space-5)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <span className="spinner" style={{ color: "var(--color-brand-400)" }} />
                  <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{TX_LABELS[txStatus]}</span>
                </div>
                <div style={{ marginTop: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {[
                    [TX_STATUS.UPLOADING_IPFS,   "Upload to IPFS"],
                    [TX_STATUS.WAITING_METAMASK, "Sign with MetaMask"],
                    [TX_STATUS.TX_PROCESSING,    "Mine transaction"],
                    [TX_STATUS.CONFIRMING,       "Verify on backend"],
                  ].map(([status, label]) => {
                    const order = [TX_STATUS.UPLOADING_IPFS, TX_STATUS.WAITING_METAMASK, TX_STATUS.TX_SUBMITTED, TX_STATUS.TX_PROCESSING, TX_STATUS.CONFIRMING];
                    const done   = order.indexOf(status) < order.indexOf(txStatus);
                    const active = status === txStatus || (status === TX_STATUS.WAITING_METAMASK && txStatus === TX_STATUS.TX_SUBMITTED);
                    return (
                      <div key={status} style={{
                        display: "flex", alignItems: "center", gap: "var(--space-2)",
                        color: done ? "var(--color-success-500)" : active ? "var(--dark-text-primary)" : "var(--dark-text-tertiary)",
                        fontSize: "var(--text-xs)",
                      }}>
                        {done ? "✓" : active ? "→" : "○"} {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="card">
              <form onSubmit={handleRegister} noValidate>
                <div className="form-group">
                  <label className="form-label">Document File</label>
                  <div
                    className={`drop-zone${dragging ? " drop-zone--active" : ""}${file ? " drop-zone--filled" : ""}`}
                    onDrop={(e) => { e.preventDefault(); setDragging(false); acceptFile(e.dataTransfer.files[0]); }}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
                    onClick={() => !file && inputRef.current?.click()}
                    role="button" tabIndex={file ? -1 : 0}
                    aria-label="Drop document here or click to browse"
                    onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !file) inputRef.current?.click(); }}
                  >
                    <input ref={inputRef} type="file" className="drop-zone-input"
                      onChange={(e) => acceptFile(e.target.files[0])}
                      disabled={isRegistering} aria-hidden="true" tabIndex={-1} />
                    {!file ? (
                      <div className="drop-zone-empty">
                        <div className="drop-zone-icon">
                          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                            <rect width="40" height="40" rx="12" fill="rgba(24,199,176,0.08)" />
                            <path d="M20 26V14M14 20l6-6 6 6" stroke="#18C7B0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M13 30h14" stroke="#18C7B0" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        </div>
                        <div className="drop-zone-label">
                          <span className="drop-zone-primary">Drop file here</span>
                          <span className="drop-zone-secondary">or <span className="drop-zone-browse">browse</span></span>
                        </div>
                        <p className="drop-zone-meta">Any file · Max 20 MB</p>
                      </div>
                    ) : (
                      <div className="drop-zone-preview">
                        <div style={{ fontSize: 32 }}>📄</div>
                        <div className="drop-zone-fileinfo">
                          <span className="drop-zone-filename">{file.name}</span>
                          <span className="drop-zone-filesize">{fmt(file.size)}</span>
                        </div>
                        <button type="button" className="drop-zone-remove"
                          onClick={(e) => { e.stopPropagation(); setFile(null); if (inputRef.current) inputRef.current.value = ""; }}
                          aria-label="Remove">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {fileErr && <p className="form-error" role="alert">{fileErr}</p>}
                </div>

                <div className="alert alert--warning" style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-xs)" }}>
                  <div className="alert-body">
                    The file's SHA-256 hash is pinned to IPFS via Pinata and registered on the blockchain
                    through your MetaMask wallet. MetaMask will ask you to confirm the transaction.
                  </div>
                </div>

                {!walletAddress && (
                  <div className="alert alert--warning" style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-xs)" }}>
                    <div className="alert-body">⚠ Connect your MetaMask wallet to register documents.</div>
                  </div>
                )}
                {walletAddress && !linkedWallet && (
                  <div className="alert alert--warning" style={{ marginBottom: "var(--space-4)", fontSize: "var(--text-xs)" }}>
                    <div className="alert-body">⚠ Click "Link Wallet" to verify ownership of your account before registering.</div>
                  </div>
                )}

                <button type="submit" className="btn btn-primary btn-lg"
                  disabled={!canRegister || isRegistering} style={{ width: "100%" }}>
                  {isRegistering ? (
                    <><span className="spinner" aria-hidden="true" /> {TX_LABELS[txStatus]}</>
                  ) : "Register on Blockchain"}
                </button>
              </form>
            </div>
          </section>

          {/* ── Document List ──────────────────────────────────────────────────── */}
          <section>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "var(--space-5)" }}>
              Your Documents ({docs.length})
            </h2>

            {docs.length === 0 ? (
              <div className="card" style={{ textAlign: "center", color: "var(--dark-text-secondary)" }}>
                <p>No documents registered yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {docs.map((doc) => (
                  <div key={doc.document_id} className="card card-sm" style={{ padding: "var(--space-5)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
                      <span style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: "var(--dark-text-primary)" }}>
                        {doc.original_filename || doc.filename || "Document"}
                      </span>
                      <span className={`badge ${doc.valid ? "badge--valid" : "badge--invalid"}`}>
                        <span className="badge-dot" />{doc.valid ? "Valid" : "Revoked"}
                      </span>
                    </div>
                    <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "var(--space-1) var(--space-4)", fontSize: "var(--text-xs)", color: "var(--dark-text-secondary)" }}>
                      <dt>SHA-256</dt>
                      <dd style={{ fontFamily: "var(--font-mono)", color: "var(--color-brand-300)", wordBreak: "break-all" }}>
                        {shortHash(doc.doc_hash || doc.document_id)}
                      </dd>
                      <dt>CID</dt>
                      <dd style={{ fontFamily: "var(--font-mono)", color: "var(--dark-text-tertiary)", wordBreak: "break-all" }}>
                        {shortHash(doc.cid)}
                      </dd>
                      <dt>Registered</dt>
                      <dd>{doc.created_at ? new Date(doc.created_at).toLocaleString() : "—"}</dd>
                      {doc.tx_hash && (
                        <>
                          <dt>Tx Hash</dt>
                          <dd style={{ fontFamily: "var(--font-mono)", color: "var(--dark-text-tertiary)" }}>{shortHash(doc.tx_hash)}</dd>
                        </>
                      )}
                      {doc.issuer && (
                        <>
                          <dt>Issuer</dt>
                          <dd style={{ fontFamily: "var(--font-mono)", color: "var(--dark-text-tertiary)" }}>{shortAddress(doc.issuer)}</dd>
                        </>
                      )}
                    </dl>
                    {doc.ipfs_url && (
                      <a href={doc.ipfs_url} target="_blank" rel="noopener noreferrer" className="result-link"
                        style={{ display: "block", marginTop: "var(--space-2)", fontSize: "var(--text-xs)" }}>
                        View on IPFS ↗
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
