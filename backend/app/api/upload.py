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
    "documents": {".pdf", ".docx", ".txt", ".md"},
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

    uploaded = {"images": [], "templates": [], "documents": [], "session_id": session_id}
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if (
            ext not in ALLOWED_EXTENSIONS["images"]
            and ext not in ALLOWED_EXTENSIONS["templates"]
            and ext not in ALLOWED_EXTENSIONS["documents"]
        ):
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext or '(none)'}")

        # basename() strips directory components so a crafted filename can't write
        # outside session_dir; the stored name is also what later requests must
        # reference (see generate.py's template_file/image_files validation).
        safe_name = os.path.basename(file.filename)
        dest = os.path.join(session_dir, safe_name)

        size = 0
        try:
            with open(dest, "wb") as f:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > max_bytes:
                        raise HTTPException(status_code=413, detail=f"{file.filename} exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")
                    f.write(chunk)
        except HTTPException:
            if os.path.exists(dest):
                os.remove(dest)
            raise

        if ext in ALLOWED_EXTENSIONS["images"]:
            uploaded["images"].append(safe_name)
        elif ext in ALLOWED_EXTENSIONS["templates"]:
            uploaded["templates"].append(safe_name)
        elif ext in ALLOWED_EXTENSIONS["documents"]:
            uploaded["documents"].append(safe_name)

    return JSONResponse(content=uploaded)


@router.delete("/upload/{session_id}")
async def cleanup_session(session_id: str):
    """Clean up uploaded files after generation."""
    session_dir = os.path.join(settings.UPLOAD_DIR, session_id)
    if os.path.exists(session_dir):
        shutil.rmtree(session_dir)
    return {"message": "Session cleaned up"}
