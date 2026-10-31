"""
ipfs_service.py
Handles uploading files to IPFS via the Pinata pinning service.

Pinata API docs: https://docs.pinata.cloud/api-reference/endpoint/ipfs/pin-file-to-ipfs
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

PINATA_JWT = os.getenv("PINATA_JWT")

# Pinata endpoint for pinning a file
PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"


def upload_to_ipfs(file_bytes: bytes, filename: str) -> str:
    """
    Upload a file to IPFS via Pinata.

    Args:
        file_bytes: Raw bytes of the file to upload.
        filename:   Original filename (used as metadata).

    Returns:
        The IPFS CID (IpfsHash) returned by Pinata.

    Raises:
        ValueError: If PINATA_JWT is not set.
        RuntimeError: If the Pinata API call fails.
    """
    if not PINATA_JWT:
        raise ValueError(
            "PINATA_JWT is not set. Add it to your backend/.env file."
        )

    headers = {
        "Authorization": f"Bearer {PINATA_JWT}",
    }

    # Pinata expects a multipart/form-data body with the file under the key "file"
    files = {
        "file": (filename, file_bytes),
    }

    # Optional metadata — helps identify the file in the Pinata dashboard
    data = {
        "pinataMetadata": '{"name": "' + filename + '"}',
    }

    response = requests.post(
        PINATA_PIN_URL,
        headers=headers,
        files=files,
        data=data,
        timeout=30,
    )

    if response.status_code != 200:
        raise RuntimeError(
            f"Pinata upload failed [{response.status_code}]: {response.text}"
        )

    result = response.json()
    cid = result.get("IpfsHash")

    if not cid:
        raise RuntimeError("Pinata returned a response but IpfsHash is missing.")

    return cid


def get_ipfs_url(cid: str) -> str:
    """Return a public IPFS gateway URL for a given CID."""
    return f"https://gateway.pinata.cloud/ipfs/{cid}"
