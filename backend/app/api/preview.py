import os
import json
from datetime import datetime, timedelta
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.core.config import settings

router = APIRouter()

HISTORY_FILE = os.path.join(settings.OUTPUT_DIR, "history.json")

# ── History persistence ───────────────────────────────────────────────────────

def _load_history() -> list:
    try:
        if os.path.exists(HISTORY_FILE):
            return json.loads(open(HISTORY_FILE).read())
    except Exception:
        pass
    return []

def _save_history(store: list):
    try:
        os.makedirs(settings.OUTPUT_DIR, exist_ok=True)
        open(HISTORY_FILE, "w").write(json.dumps(store, indent=2))
    except Exception as e:
        print(f"[History] Save failed: {e}")

# Shared in-memory store — loaded from disk on first access
_history_cache: list | None = None

def _get_history() -> list:
    global _history_cache
    if _history_cache is None:
        _history_cache = _load_history()
    return _history_cache

# history_store is imported by generate.py — it's a live reference
history_store = _get_history()


# ── Output cleanup ────────────────────────────────────────────────────────────

def cleanup_old_outputs(retention_days: int = 7):
    """Delete PPTX and auto images older than retention_days. Called on startup."""
    try:
        cutoff = datetime.now() - timedelta(days=retention_days)
        output_dir = settings.OUTPUT_DIR
        if not os.path.exists(output_dir):
            return
        removed = 0
        for fname in os.listdir(output_dir):
            if fname == "history.json":
                continue
            fpath = os.path.join(output_dir, fname)
            if os.path.isfile(fpath):
                mtime = datetime.fromtimestamp(os.path.getmtime(fpath))
                if mtime < cutoff:
                    os.remove(fpath)
                    removed += 1
        if removed:
            print(f"[Cleanup] Removed {removed} old output file(s) (>{retention_days}d old)")
        # Also prune history entries whose files are gone
        store = _get_history()
        before = len(store)
        store[:] = [e for e in store if os.path.exists(os.path.join(output_dir, e["filename"]))]
        if len(store) != before:
            _save_history(store)
            print(f"[Cleanup] Pruned {before - len(store)} expired history entries")
    except Exception as e:
        print(f"[Cleanup] Error: {e}")


# ── Slide count recommendation ────────────────────────────────────────────────

SLIDE_COUNT_RULES = [
    (["pitch", "startup", "investor", "funding"], 12),
    (["status", "update", "sprint", "progress"], 8),
    (["training", "tutorial", "course", "workshop"], 15),
    (["sales", "proposal", "deck"], 10),
    (["research", "report", "analysis", "findings"], 14),
    (["roadmap", "plan", "strategy", "quarter"], 10),
    (["overview", "intro", "introduction"], 8),
    (["demo", "product", "showcase"], 10),
]

class RecommendRequest(BaseModel):
    prompt: str

@router.post("/recommend-slides")
async def recommend_slides(req: RecommendRequest):
    prompt_lower = req.prompt.lower()
    for keywords, count in SLIDE_COUNT_RULES:
        if any(k in prompt_lower for k in keywords):
            return {"recommended": count, "reason": "Typical for this presentation type"}
    words = len(req.prompt.split())
    count = min(max(8, words // 8), 20)
    return {"recommended": count, "reason": "Based on prompt complexity"}


# ── History API ───────────────────────────────────────────────────────────────

@router.get("/history")
async def get_history():
    store = _get_history()
    # Return only entries whose files still exist, mark expired ones
    result = []
    for e in store:
        path = os.path.join(settings.OUTPUT_DIR, e["filename"])
        result.append({**e, "expired": not os.path.exists(path)})
    return {"history": result}

@router.delete("/history/{job_id}")
async def delete_history(job_id: str):
    store = _get_history()
    store[:] = [e for e in store if e["job_id"] != job_id]
    _save_history(store)
    return {"ok": True}
