# Decentralized Trustless Document Verifier

A blockchain-based document verification system that uses IPFS for decentralized storage and Ethereum smart contracts for tamper-proof record keeping.

## System Architecture

```
User → React Frontend → Python FastAPI → Pinata/IPFS → CID → Smart Contract → Blockchain
```

## Team Structure

| Member | Role | Stack |
|--------|------|-------|
| Nikhil Sharma | Frontend | React.js, JavaScript, CSS |
| Prince Patel | Backend | Python, FastAPI, Web3.py, Pinata |
| Shiv Pratap Singh | Blockchain | Solidity, Hardhat, ethers.js |

## How It Works

### Document Registration
1. User uploads a document via the React frontend
2. Frontend sends the file to the Python FastAPI backend
3. Backend uploads the file to IPFS via Pinata
4. Pinata returns a CID (Content Identifier)
5. Backend calls the smart contract to store: `documentId`, `CID`, `issuer`, `timestamp`, `valid=true`

### Document Verification
1. User provides a Document ID and CID
2. Backend queries the smart contract
3. Smart contract compares the stored CID with the provided CID
4. Returns `VALID` if they match and the document is not revoked, else `INVALID`

## Project Structure

```
Decentralized-Document-Verifier/
├── frontend/           ← React UI
├── backend/            ← Python FastAPI server
├── blockchain/         ← Solidity contracts + Hardhat
└── README.md
```

## Quick Start

### 1. Blockchain (run first)

```bash
cd blockchain
npm install
npx hardhat node          # Start local blockchain
npx hardhat run scripts/deploy.js --network localhost
```

Copy the deployed contract address into `backend/.env`.

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements.txt
cp .env.example .env        # Fill in your values
uvicorn app.main:app --reload
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Environment Variables

See `backend/.env.example` for required variables:

- `PINATA_JWT` — Your Pinata JWT token (get from pinata.cloud)
- `RPC_URL` — Blockchain RPC URL (e.g., `http://127.0.0.1:8545` for local Hardhat)
- `CONTRACT_ADDRESS` — Deployed smart contract address
- `PRIVATE_KEY` — Wallet private key (use a test wallet only!)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents/register` | Register a new document |
| POST | `/api/documents/verify` | Verify a document by ID and CID |
| GET | `/api/documents/{document_id}` | Get document details |
| POST | `/api/documents/revoke` | Revoke a registered document |

## Future Enhancements

- Multi-signature authorization
- Role-based access control (issuer/verifier/admin)
- Database for off-chain metadata (MongoDB)
- Zero-knowledge proof verification
- Mobile app frontend
- Document expiry timestamps
