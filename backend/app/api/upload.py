import os
import uuid
import shutil
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import List, Optional
from app.core.config import settings

router = APIRouter()

ALLOWED_EXTENSIONS = {
    "images": {".jpg", ".jpeg", ".png", ".gif", ".webp"},
    "templates": {".pptx"},
}


@router.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    session_id: Optional[str] = Form(None)
):
    """Upload images and/or template files. Returns session_id and file list."""
    if not session_id:
        session_id = str(uuid.uuid4())

    session_dir = os.path.join(settings.UPLOAD_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    uploaded = {"images": [], "templates": [], "session_id": session_id}

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        size = 0

        dest = os.path.join(session_dir, os.path.basename(file.filename))
        with open(dest, "wb") as f:
            content = await file.read()
            size = len(content)
            if size > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
                raise HTTPException(status_code=413, detail=f"{file.filename} exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")
            f.write(content)

        if ext in ALLOWED_EXTENSIONS["images"]:
            uploaded["images"].append(file.filename)
        elif ext in ALLOWED_EXTENSIONS["templates"]:
            uploaded["templates"].append(file.filename)

    return JSONResponse(content=uploaded)


@router.delete("/upload/{session_id}")
async def cleanup_session(session_id: str):
    """Clean up uploaded files after generation."""
    session_dir = os.path.join(settings.UPLOAD_DIR, session_id)
    if os.path.exists(session_dir):
        shutil.rmtree(session_dir)
    return {"message": "Session cleaned up"}
