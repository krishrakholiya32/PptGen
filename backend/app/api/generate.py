import os
import shutil
import uuid
import asyncio
import json
import time
import threading
from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from app.core.config import settings
from app.api.auth import require_user
from app.models.user import User
from app.services.style_extractor import extractor
from app.services.content_planner import planner
from app.services.renderer_pptx import renderer_pptx
from app.services.image_fetcher import fetch_images_for_slides
from app.services.web_search import get_web_context

router = APIRouter()

# ── Persistent jobs store ─────────────────────────────────────────────────────

def _jobs_file() -> str:
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
    return os.path.join(settings.OUTPUT_DIR, "_jobs.json")

def _load_jobs() -> dict:
    try:
        with open(_jobs_file()) as f:
            return json.load(f)
    except Exception:
        return {}

def _save_jobs(j: dict):
    try:
        with open(_jobs_file(), "w") as f:
            json.dump(j, f)
    except Exception as e:
        print(f"[Jobs] Failed to save jobs: {e}")

jobs: dict = _load_jobs()


# ── Persistent slide plans store ──────────────────────────────────────────────

def _plans_dir() -> str:
    d = os.path.join(settings.OUTPUT_DIR, "_plans")
    os.makedirs(d, exist_ok=True)
    return d

def _plan_file(job_id: str) -> str:
    return os.path.join(_plans_dir(), f"{job_id}.json")

def _save_plan(job_id: str, data: dict):
    try:
        with open(_plan_file(job_id), "w") as f:
            json.dump(data, f)
    except Exception as e:
        print(f"[Plans] Failed to save plan {job_id}: {e}")

def _load_plan(job_id: str) -> Optional[dict]:
    try:
        with open(_plan_file(job_id)) as f:
            return json.load(f)
    except Exception:
        return None

slide_plans: dict = {}  # in-memory cache; falls back to disk


# ── Per-IP rate limiting ──────────────────────────────────────────────────────

_rate_lock = threading.Lock()
_ip_buckets: dict[str, list[float]] = defaultdict(list)
_IP_HOURLY_LIMIT = 5

def _check_rate_limit(client_ip: str):
    now = time.monotonic()
    with _rate_lock:
        bucket = [t for t in _ip_buckets[client_ip] if now - t < 3600]
        if len(bucket) >= _IP_HOURLY_LIMIT:
            raise HTTPException(
                status_code=429,
                detail="You've generated 5 presentations this hour. Please wait before trying again."
            )
        bucket.append(now)
        _ip_buckets[client_ip] = bucket


# ── Models ────────────────────────────────────────────────────────────────────

class ThemeColors(BaseModel):
    bg: str = "#FFFFFF"
    accent: str = "#0070C0"
    text: str = "#1A1A1A"


class GenerateRequest(BaseModel):
    prompt: str
    slide_count: int = 10
    session_id: str
    template_file: Optional[str] = None
    image_files: Optional[List[str]] = []
    theme_colors: Optional[ThemeColors] = None
    use_web_search: bool = False
    content_density: str = "medium"
    tone: str = "general"


class RegenerateSlideRequest(BaseModel):
    job_id: str
    slide_index: int
    instruction: Optional[str] = ""


class EditSlideRequest(BaseModel):
    job_id: str
    slide_index: int
    title: Optional[str] = None
    bullets: Optional[List[str]] = None
    speaker_notes: Optional[str] = None


class ReorderRequest(BaseModel):
    job_id: str
    slide_order: List[int]


class JobStatus(BaseModel):
    job_id: str
    status: str
    progress: int = 0
    message: str = ""
    download_url: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=JobStatus)
async def generate_document(req: GenerateRequest, background_tasks: BackgroundTasks, request: Request, current_user: User = Depends(require_user)):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    job_id = str(uuid.uuid4())
    jobs[job_id] = {"status": "pending", "progress": 0, "message": "Queued"}
    _save_jobs(jobs)
    background_tasks.add_task(run_generation, job_id, req, current_user.username)
    return JobStatus(job_id=job_id, status="pending", message="Job queued")


@router.get("/job/{job_id}", response_model=JobStatus)
async def get_job_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    j = jobs[job_id]
    return JobStatus(
        job_id=job_id,
        status=j["status"],
        progress=j["progress"],
        message=j["message"],
        download_url=j.get("download_url")
    )


async def run_generation(job_id: str, req: GenerateRequest, username: str = ""):
    session_dir = os.path.join(settings.UPLOAD_DIR, req.session_id)
    try:
        jobs[job_id] = {"status": "running", "progress": 5, "message": "Starting..."}
        _save_jobs(jobs)

        os.makedirs(session_dir, exist_ok=True)
        output_dir = settings.OUTPUT_DIR
        os.makedirs(output_dir, exist_ok=True)

        # Clean up stale upload sessions and old outputs
        _cleanup_old_sessions()
        from app.api.preview import cleanup_old_outputs
        cleanup_old_outputs(retention_hours=1)

        # Step 1: Extract style
        jobs[job_id].update({"progress": 10, "message": "Extracting style from template..."})
        _save_jobs(jobs)
        style = {}
        if req.template_file:
            template_path = os.path.join(session_dir, req.template_file)
            if os.path.exists(template_path):
                style = await extractor.extract(template_path)
        if not style:
            style = extractor._default_style()

        if req.theme_colors:
            style["background_color"] = req.theme_colors.bg
            style["accent_color"]     = req.theme_colors.accent
            style["text_color"]       = req.theme_colors.text

        # Step 2: Optional web search
        final_prompt = req.prompt
        if req.use_web_search:
            jobs[job_id].update({"progress": 18, "message": "Searching web for current facts..."})
            _save_jobs(jobs)
            web_context = await get_web_context(req.prompt)
            if web_context:
                final_prompt = req.prompt + web_context

        # Step 3: Plan content
        jobs[job_id].update({"progress": 28, "message": "Planning presentation structure with AI..."})
        _save_jobs(jobs)
        image_files = req.image_files or []
        plan = await planner.plan_pptx(
            final_prompt, style, req.slide_count, image_files,
            content_density=req.content_density,
            tone=req.tone
        )

        # Step 4: Fetch images
        jobs[job_id].update({"progress": 55, "message": "Fetching images for slides..."})
        _save_jobs(jobs)
        if plan.get("slides"):
            plan["slides"] = await fetch_images_for_slides(plan["slides"], session_dir)

        # Cache plan (memory + disk)
        cached = {"plan": plan, "style": style, "session_dir": session_dir, "req": req.model_dump()}
        slide_plans[job_id] = cached
        _save_plan(job_id, cached)

        # Step 5: Render
        jobs[job_id].update({"progress": 70, "message": "Rendering presentation..."})
        _save_jobs(jobs)
        file_title = plan.get("file_title", "")
        if file_title and len(file_title) >= 3:
            safe_title = "".join(c for c in file_title.strip().replace(" ", "_") if c.isalnum() or c in "_-")
        else:
            safe_title = req.prompt[:30].strip().replace(" ", "_").replace("/", "-")
            safe_title = "".join(c for c in safe_title if c.isalnum() or c in "_-")
        safe_title = safe_title[:40] or "presentation"
        output_filename = f"{safe_title}_{job_id[:8]}.pptx"
        output_path = os.path.join(output_dir, output_filename)
        renderer_pptx.render(plan, style, session_dir, output_path)

        jobs[job_id].update({
            "status": "done",
            "progress": 100,
            "message": "Presentation ready!",
            "download_url": f"/outputs/{output_filename}",
            "job_id": job_id,
        })
        _save_jobs(jobs)

        # Save to history
        try:
            from app.api.preview import history_store, _save_history
            entry = {
                "job_id": job_id,
                "username": username,
                "prompt": req.prompt[:120],
                "slide_count": req.slide_count,
                "filename": output_filename,
                "download_url": f"/outputs/{output_filename}",
                "created_at": datetime.now().isoformat(),
                "theme": req.theme_colors.model_dump() if req.theme_colors else None,
            }
            history_store.insert(0, entry)
            if len(history_store) > 20:
                history_store.pop()
            _save_history(history_store)
        except Exception as e:
            print(f"[Generate] History save failed: {e}")

        # Copy auto-fetched slide images to outputs/ so preview can serve them
        try:
            import glob
            for img_path in glob.glob(os.path.join(session_dir, "auto_*.jpg")):
                dest = os.path.join(output_dir, os.path.basename(img_path))
                if not os.path.exists(dest):
                    import shutil as _shutil
                    _shutil.copy2(img_path, dest)
        except Exception as e:
            print(f"[Generate] Image copy failed: {e}")

        # Session uploads kept for 1h so re-renders can use user images.
        # _cleanup_old_sessions() handles deletion on the next generation.

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        # Don't expose raw exception details to the client
        jobs[job_id].update({"status": "error", "progress": 0, "message": "Generation failed. Check your API key and try again."})
        _save_jobs(jobs)
        print(f"[Generate] Job {job_id} failed: {e}")
        traceback.print_exc()


def _cleanup_old_sessions():
    """Delete upload sessions older than 1 hour. Outputs are managed separately by preview.py."""
    try:
        cutoff = datetime.now() - timedelta(hours=1)
        upload_dir = settings.UPLOAD_DIR
        if os.path.exists(upload_dir):
            for session in os.listdir(upload_dir):
                session_path = os.path.join(upload_dir, session)
                if os.path.isdir(session_path):
                    mtime = datetime.fromtimestamp(os.path.getmtime(session_path))
                    if mtime < cutoff:
                        shutil.rmtree(session_path)
                        print(f"[Cleanup] Removed old session: {session}")
    except Exception as e:
        print(f"[Cleanup] Error: {e}")


@router.get("/slide-plan/{job_id}")
async def get_slide_plan(job_id: str):
    # Try memory first, then disk
    cached = slide_plans.get(job_id) or _load_plan(job_id)
    if not cached:
        raise HTTPException(status_code=404, detail="Plan not found or expired")
    # Warm memory cache
    slide_plans[job_id] = cached

    plan = cached["plan"]
    style = cached["style"]
    slides = []
    for s in plan.get("slides", []):
        img = s.get("image")
        img_url = f"/outputs/{img}" if img else None
        slides.append({
            "slide_number": s.get("slide_number"),
            "title":         s.get("title", ""),
            "subtitle":      s.get("subtitle", ""),
            "bullets":       s.get("bullets", [])[:6],
            "speaker_notes": s.get("speaker_notes", ""),
            "layout_type":   s.get("layout_type", "title_content"),
            "image_url":     img_url,
        })
    return {
        "title": plan.get("title", ""),
        "slides": slides,
        "style": {
            "bg": style.get("background_color", "#1A1A2E"),
            "accent": style.get("accent_color", "#E94560"),
            "text": style.get("text_color", "#EAEAEA"),
        }
    }


@router.post("/edit-slide")
async def edit_slide(req: EditSlideRequest, background_tasks: BackgroundTasks):
    cached = slide_plans.get(req.job_id) or _load_plan(req.job_id)
    if not cached:
        raise HTTPException(status_code=404, detail="Job not found or expired — please generate a new presentation")

    slide_plans[req.job_id] = cached
    plan   = cached["plan"]
    slides = plan.get("slides", [])
    if req.slide_index < 0 or req.slide_index >= len(slides):
        raise HTTPException(status_code=400, detail="Invalid slide index")

    slide = slides[req.slide_index]
    if req.title         is not None: slide["title"]         = req.title
    if req.bullets       is not None: slide["bullets"]       = req.bullets
    if req.speaker_notes is not None: slide["speaker_notes"] = req.speaker_notes

    new_job_id = str(uuid.uuid4())
    jobs[new_job_id] = {"status": "pending", "progress": 0, "message": "Queued"}
    _save_jobs(jobs)
    background_tasks.add_task(_rerender, new_job_id, cached)
    return {"job_id": new_job_id, "status": "pending"}


@router.post("/regenerate-slide")
async def regenerate_slide(req: RegenerateSlideRequest, background_tasks: BackgroundTasks):
    cached = slide_plans.get(req.job_id) or _load_plan(req.job_id)
    if not cached:
        raise HTTPException(status_code=404, detail="Job not found or expired — please generate a new presentation")

    slide_plans[req.job_id] = cached
    plan   = cached["plan"]
    slides = plan.get("slides", [])
    if req.slide_index < 0 or req.slide_index >= len(slides):
        raise HTTPException(status_code=400, detail="Invalid slide index")

    new_job_id = str(uuid.uuid4())
    jobs[new_job_id] = {"status": "pending", "progress": 0, "message": "Queued"}
    _save_jobs(jobs)
    background_tasks.add_task(_regenerate_slide_task, new_job_id, cached, req.slide_index, req.instruction)
    return {"job_id": new_job_id, "status": "pending"}


async def _regenerate_slide_task(job_id: str, cached: dict, slide_index: int, instruction: str):
    try:
        jobs[job_id] = {"status": "running", "progress": 20, "message": "Regenerating slide content..."}
        _save_jobs(jobs)
        plan  = cached["plan"]
        slide = plan["slides"][slide_index]
        topic = cached["req"].get("prompt", "")

        extra = f"\nUser instruction: {instruction}" if instruction else ""
        regen_prompt = f"""Rewrite this slide for a presentation about: "{topic}"{extra}

Current slide title: {slide.get('title')}

Generate fresh, different content. Return JSON only:
{{
  "title": "...",
  "bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "speaker_notes": "..."
}}"""

        from app.services.llm_service import llm
        new_content = await llm.generate_json(regen_prompt, max_tokens=600)
        slide.update(new_content)
        _save_plan(job_id, cached)

        jobs[job_id].update({"progress": 70, "message": "Re-rendering presentation..."})
        _save_jobs(jobs)
        await _rerender(job_id, cached)
    except Exception as e:
        jobs[job_id].update({"status": "error", "progress": 0, "message": "Regeneration failed. Please try again."})
        _save_jobs(jobs)
        print(f"[Regen] Job {job_id} failed: {e}")


@router.get("/stream/{job_id}")
async def stream_job_status(job_id: str):
    """SSE endpoint — emits job status every second until done/error."""
    async def gen():
        for _ in range(360):  # max 6 minutes
            j = jobs.get(job_id)
            if not j:
                yield f"data: {json.dumps({'error': 'not_found'})}\n\n"
                return
            yield f"data: {json.dumps({'status': j['status'], 'progress': j['progress'], 'message': j['message'], 'download_url': j.get('download_url')})}\n\n"
            if j["status"] in ("done", "error"):
                return
            await asyncio.sleep(1)
    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/reorder-slides")
async def reorder_slides(req: ReorderRequest, background_tasks: BackgroundTasks):
    cached = slide_plans.get(req.job_id) or _load_plan(req.job_id)
    if not cached:
        raise HTTPException(status_code=404, detail="Job not found or expired")
    slide_plans[req.job_id] = cached
    slides = cached["plan"].get("slides", [])
    if len(req.slide_order) != len(slides):
        raise HTTPException(status_code=400, detail="Slide order length mismatch")
    cached["plan"]["slides"] = [slides[i] for i in req.slide_order]
    new_job_id = str(uuid.uuid4())
    jobs[new_job_id] = {"status": "pending", "progress": 0, "message": "Queued"}
    _save_jobs(jobs)
    background_tasks.add_task(_rerender, new_job_id, cached)
    return {"job_id": new_job_id, "status": "pending"}


async def _rerender(job_id: str, cached: dict):
    try:
        jobs[job_id] = {"status": "running", "progress": 70, "message": "Re-rendering..."}
        _save_jobs(jobs)
        plan        = cached["plan"]
        style       = cached["style"]
        session_dir = cached["session_dir"]
        orig_req    = cached["req"]

        file_title = plan.get("file_title", "")
        if file_title and len(file_title) >= 3:
            safe_title = "".join(c for c in file_title.strip().replace(" ", "_") if c.isalnum() or c in "_-")
        else:
            safe_title = orig_req.get("prompt", "pptx")[:30].strip().replace(" ", "_").replace("/", "-")
            safe_title = "".join(c for c in safe_title if c.isalnum() or c in "_-")
        safe_title = safe_title[:40] or "presentation"
        output_filename = f"{safe_title}_{job_id[:8]}.pptx"
        output_path = os.path.join(settings.OUTPUT_DIR, output_filename)

        renderer_pptx.render(plan, style, session_dir, output_path)
        slide_plans[job_id] = cached
        _save_plan(job_id, cached)

        jobs[job_id].update({
            "status": "done",
            "progress": 100,
            "message": "Done!",
            "download_url": f"/outputs/{output_filename}",
        })
        _save_jobs(jobs)
    except Exception as e:
        jobs[job_id].update({"status": "error", "progress": 0, "message": "Re-render failed. Please try again."})
        _save_jobs(jobs)
        print(f"[Rerender] Job {job_id} failed: {e}")
