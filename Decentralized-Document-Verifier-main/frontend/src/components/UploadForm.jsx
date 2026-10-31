import React, { useState, useRef, useCallback } from "react";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function FileIcon({ ext }) {
  const color =
    ["pdf"].includes(ext) ? "#EF5B68" :
    ["doc","docx"].includes(ext) ? "#5B8CFF" :
    ["jpg","jpeg","png","gif","webp"].includes(ext) ? "#18C7B0" :
    "#A9BBB9";

  return (
    <svg width="40" height="48" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M6 0h20l14 14v30a4 4 0 01-4 4H6a4 4 0 01-4-4V4a4 4 0 014-4z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5"/>
      <path d="M26 0v14h14" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
      <text x="20" y="36" textAnchor="middle" fill={color} fontSize="9" fontWeight="700" fontFamily="monospace">
        {(ext || "file").toUpperCase().slice(0,4)}
      </text>
    </svg>
  );
}

/**
 * UploadForm — Premium drag-and-drop document upload.
 * Props: onSubmit(documentId, file), loading
 */
export default function UploadForm({ onSubmit, loading }) {
  const [documentId, setDocumentId] = useState("");
  const [file, setFile]             = useState(null);
  const [fileError, setFileError]   = useState("");
  const [dragActive, setDragActive] = useState(false);

  const inputRef = useRef(null);

  const acceptFile = useCallback((selected) => {
    setFileError("");
    if (!selected) return;
    if (selected.size > MAX_SIZE) {
      setFileError("File size must be under 10 MB.");
      return;
    }
    setFile(selected);
  }, []);

  const handleFileChange = (e) => acceptFile(e.target.files[0]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files[0];
    acceptFile(dropped);
  }, [acceptFile]);

  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setDragActive(false); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!documentId.trim()) return;
    if (!file) { setFileError("Please select a document to upload."); return; }
    onSubmit(documentId.trim(), file);
  };

  const removeFile = (e) => {
    e.stopPropagation();
    setFile(null);
    setFileError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const fileExt = file ? file.name.split(".").pop().toLowerCase() : "";

  return (
    <form className="upload-form" onSubmit={handleSubmit} noValidate>
      {/* Document ID */}
      <div className="form-group">
        <label htmlFor="doc-id" className="form-label">
          Document ID
        </label>
        <input
          id="doc-id"
          type="text"
          className="form-input"
          placeholder="e.g. CERT-2024-001"
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          disabled={loading}
          required
          aria-describedby="doc-id-hint"
          autoComplete="off"
        />
        <p id="doc-id-hint" className="form-hint">
          A unique identifier — you will need this to verify the document later.
        </p>
      </div>

      {/* Drop zone */}
      <div className="form-group">
        <label className="form-label">Document File</label>

        <div
          className={`drop-zone${dragActive ? " drop-zone--active" : ""}${file ? " drop-zone--filled" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !file && inputRef.current?.click()}
          role="button"
          tabIndex={file ? -1 : 0}
          aria-label="Drop document here or click to browse"
          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !file) inputRef.current?.click(); }}
        >
          <input
            ref={inputRef}
            type="file"
            id="doc-file"
            className="drop-zone-input"
            onChange={handleFileChange}
            disabled={loading}
            aria-hidden="true"
            tabIndex={-1}
          />

          {!file ? (
            <div className="drop-zone-empty">
              <div className="drop-zone-icon" aria-hidden="true">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect width="40" height="40" rx="12" fill="rgba(24,199,176,0.08)"/>
                  <path d="M20 26V14M14 20l6-6 6 6" stroke="#18C7B0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M13 30h14" stroke="#18C7B0" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="drop-zone-label">
                <span className="drop-zone-primary">Drop your document here</span>
                <span className="drop-zone-secondary">or <span className="drop-zone-browse">click to browse</span></span>
              </div>
              <p className="drop-zone-meta">PDF, DOCX, PNG, JPG · Max 10 MB</p>
            </div>
          ) : (
            <div className="drop-zone-preview">
              <FileIcon ext={fileExt} />
              <div className="drop-zone-fileinfo">
                <span className="drop-zone-filename">{file.name}</span>
                <span className="drop-zone-filesize">{formatBytes(file.size)}</span>
              </div>
              <button
                type="button"
                className="drop-zone-remove"
                onClick={removeFile}
                aria-label="Remove selected file"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}
        </div>

        {fileError && (
          <p className="form-error" role="alert">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5.25" stroke="#EF5B68" strokeWidth="1.5"/>
              <path d="M6 3.5V6.5M6 8.5h.01" stroke="#EF5B68" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {fileError}
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="btn btn-primary btn-lg upload-submit"
        disabled={loading || !documentId.trim() || !file}
      >
        {loading ? (
          <>
            <span className="spinner" aria-hidden="true" />
            <span>Registering on Blockchain…</span>
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M9 2v10M5 8l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Register Document
          </>
        )}
      </button>
    </form>
  );
}
