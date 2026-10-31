"""
main.py
FastAPI entry point — TrueDocs v2
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes        import router         as documents_router
from .org_routes    import router         as org_router
from .admin_routes  import router         as admin_router
from .public_routes import router         as public_router
from .db            import init_db, close_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()


app = FastAPI(
    title="TrueDocs API",
    description="Decentralized Document Verification — organization approval + blockchain",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(documents_router, prefix="/api")   # /api/documents (legacy)
app.include_router(org_router,       prefix="/api")   # /api/org
app.include_router(admin_router,     prefix="/api")   # /api/admin
app.include_router(public_router,    prefix="/api")   # /api/public


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "TrueDocs API v2 is running"}
