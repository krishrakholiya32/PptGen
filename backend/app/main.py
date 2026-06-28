from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api import generate, upload, preview
from app.api import auth as auth_module
from app.core.config import settings
from app.database.db import init_db
import os
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.ENVIRONMENT == "development" else logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="PptGen API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

init_db()

# On startup: clean outputs older than 1 hour, prune expired history
from app.api.preview import cleanup_old_outputs
cleanup_old_outputs(retention_hours=1)

app.include_router(auth_module.router)
app.include_router(generate.router, prefix="/api")
app.include_router(upload.router,   prefix="/api")
app.include_router(preview.router,  prefix="/api")

app.mount("/outputs", StaticFiles(directory=settings.OUTPUT_DIR), name="outputs")


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "service": "PptGen API"
    }


# Serve React frontend (must be last — catch-all)
from fastapi.responses import FileResponse
_FRONTEND = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")
if os.path.exists(_FRONTEND):
    app.mount("/assets", StaticFiles(directory=os.path.join(_FRONTEND, "assets")), name="frontend-assets")

    @app.get("/favicon.svg", include_in_schema=False)
    async def favicon():
        return FileResponse(os.path.join(_FRONTEND, "favicon.svg"), media_type="image/svg+xml")

    @app.get("/icons.svg", include_in_schema=False)
    async def icons():
        return FileResponse(os.path.join(_FRONTEND, "icons.svg"), media_type="image/svg+xml")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        index = os.path.join(_FRONTEND, "index.html")
        return FileResponse(index)

