# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

PptGen is a full-stack AI presentation generator. Users describe a topic; the backend plans slides with LLaMA 3.3 70B, fetches images, renders a `.pptx` with python-pptx, and streams real-time progress via SSE. The frontend (React 19 + Vite) is built and committed to `frontend/dist/` — FastAPI serves it directly (no separate web server).

Live at **https://pptgen.zrik.tech** (Heroku eco dyno, single process).

---

## Commands

```bash
# Backend
cd backend
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env   # set GROQ_API_KEY, JWT_SECRET_KEY
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (dev)
cd frontend
npm install
npm run dev   # http://localhost:5173  (proxies /api → localhost:8000)

# Frontend (production build — MUST do this before deploying)
cd frontend
npm run build
# Then commit frontend/dist/ with git add -f frontend/dist/

# Deploy to Heroku
git push heroku main
```

- App: `http://localhost:5173` (dev) or `http://localhost:8000` (prod build served by FastAPI)
- API docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

---

## Architecture

### Request Flow (generation)

1. `POST /api/generate` — requires JWT, rate-limited (5/hr per IP)
2. BackgroundTask: `run_generation(job_id, req, username)` in `generate.py`
   - Style extraction from uploaded template (or default style)
   - Optional web search via DuckDuckGo (`web_search.py`)
   - AI slide planning: LLaMA 3.3 70B returns structured JSON plan (`content_planner.py`)
   - Image fetching: DuckDuckGo images per slide (`image_fetcher.py`)
   - PPTX rendering: python-pptx (`renderer_pptx.py`)
   - History entry saved to disk (`preview.py:history_store`)
3. `GET /api/stream/{job_id}` — SSE, 1-second interval, max 6 minutes
4. `GET /api/job/{job_id}` — HTTP polling fallback (used when SSE fails)

### Slide editing flow

- Edit / reorder / AI-rewrite all spawn a new `_rerender` background task
- Each re-render returns a new `job_id`; the frontend polls it and swaps the active job
- Session upload directory is kept for 1 hour (not deleted immediately after generation) so re-renders can use user-uploaded images

### Frontend → Backend (production)

FastAPI `main.py`:
- Mounts `/assets` → `frontend/dist/assets/` (Vite JS/CSS bundles)
- Mounts `/outputs` → `backend/outputs/` (PPTX files + auto-fetched images)
- Catch-all `/{full_path:path}` → serves `frontend/dist/index.html`

`VITE_API_URL=/api` in `.env.production` — relative path, same origin on Heroku.

**Important:** `import.meta.env.VITE_API_URL` is `""` (empty string) when set to `/api`, which is falsy in JS. Always check `!= null` not `||` when deriving the base URL:
```js
const BASE = import.meta.env.VITE_API_URL != null
  ? import.meta.env.VITE_API_URL.replace("/api", "")
  : "http://localhost:8000"
```

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app — CORS, static mounts, catch-all |
| `backend/app/core/config.py` | Pydantic settings — `cors_origins_list` property handles comma-separated env var |
| `backend/app/api/auth.py` | JWT auth — `get_current_user` (optional), `require_user` (strict) |
| `backend/app/api/generate.py` | Job queue, SSE stream, edit/regen/reorder endpoints |
| `backend/app/api/preview.py` | History API (auth-gated, per-user), slide-count recommender, output cleanup |
| `backend/app/api/upload.py` | File upload — images + `.pptx` templates |
| `backend/app/services/content_planner.py` | LLM prompt → structured slide JSON |
| `backend/app/services/renderer_pptx.py` | Converts slide JSON + style → `.pptx` via python-pptx |
| `backend/app/services/image_fetcher.py` | DuckDuckGo image search, downloads to `session_dir` |
| `frontend/src/App.css` | Entire design system — CSS variables, all components, responsive breakpoints |
| `frontend/src/components/JobTracker.jsx` | SSE + polling, progress bar, done/error states |
| `frontend/src/components/SlidePreview.jsx` | Slide list sidebar + editor (edit/notes/AI rewrite/reorder) |
| `Procfile` | `web: sh -c 'cd backend && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}'` |
| `.python-version` | `3.11` — Heroku buildpack reads this |

---

## Deployment (Heroku)

- Single eco dyno — FastAPI serves everything
- `frontend/dist/` is committed to git (Heroku has no Node.js buildpack)
- Environment variables set via `heroku config:set`
- `CORS_ORIGINS` must be comma-separated (not JSON array) — Heroku CLI strips inner quotes
- Storage is ephemeral: outputs and uploads are lost on dyno restart
- Custom domain: `pptgen.zrik.tech` via CNAME at manage.get.tech

### Deploy workflow

```bash
cd frontend && npm run build && cd ..
git add -f frontend/dist/ <changed-source-files>
git commit -m "..."
git push             # GitHub
git push heroku main # Heroku
```

---

## Known Quirks

- **Pydantic v2 `CORS_ORIGINS`**: Field type must be `str`, not `List[str]`. v2 JSON-parses list fields at source level before validators run; Heroku CLI strips inner quotes making JSON invalid. Use `str` + `cors_origins_list` property.
- **`VITE_API_URL=/api` is falsy**: Empty string after removing `/api` triggers `||` fallback. Use `!= null` check.
- **Heroku ephemeral storage**: PPTX files and uploaded images exist only for the dyno's lifetime (typically a few hours). `cleanup_old_outputs()` removes files older than 1 hour on each generation.
- **Session dir lifetime**: User-uploaded images stay in `uploads/{session_id}/` for up to 1 hour so slide re-renders can embed them. `_cleanup_old_sessions()` removes them on the next generation call.
- **History is disk-persisted JSON** (`outputs/history.json`), scoped per username. Entries are pruned when their PPTX file no longer exists.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key — LLaMA 3.3 70B |
| `JWT_SECRET_KEY` | Yes | Random secret for JWT signing |
| `GEMINI_API_KEY` | No | Google Gemini fallback LLM |
| `GROQ_TEXT_MODEL` | No | Default: `llama-3.3-70b-versatile` |
| `GROQ_VISION_MODEL` | No | Default: `llama-3.2-11b-vision-preview` |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `ENVIRONMENT` | No | `development` or `production` |
| `MAX_UPLOAD_SIZE_MB` | No | Default: `10` |
