# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

PptGen is a full-stack AI presentation generator. Users describe a topic; the backend plans slides with Gemini (primary) / Groq GPT-OSS 120B (fallback), fetches images, renders a `.pptx` with python-pptx, and streams real-time progress via SSE. The frontend (React 19 + Vite + TypeScript) is built and committed to `frontend/dist/` — FastAPI serves it directly (no separate web server). The backend uses async SQLAlchemy against PostgreSQL (the `users` table only — presentation history is separately disk-persisted JSON, see below).

Live at **https://pptgen.zrik.tech** (AWS EC2, systemd service on port 8001, shares the box
with kGPT behind one Nginx).

---

## Commands

```bash
# Backend
cd backend
python -m venv venv && venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env   # set DATABASE_URL, GEMINI_API_KEY, GROQ_API_KEY, JWT_SECRET_KEY
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend (dev)
cd frontend
npm install
npm run dev   # http://localhost:5173  (proxies /api → localhost:8000)

# Frontend (production build — MUST do this before deploying)
cd frontend
npm run build
# Then commit frontend/dist/ with git add -f frontend/dist/ (still committed to git —
# the EC2 box builds it once at deploy time, but committing keeps the deploy-from-git
# workflow identical to before)

# Deploy: on the server
git pull && cd frontend && npm run build && cd ..
sudo systemctl restart pptgen
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
   - AI slide planning: Gemini (primary) / Groq GPT-OSS 120B (fallback) returns structured JSON plan (`content_planner.py`)
   - Image fetching: Unsplash → Pexels → Pixabay per slide (`image_fetcher.py`)
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

`VITE_API_URL=/api` in `.env.production` — relative path, same origin (FastAPI serves the built frontend directly).

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
| `backend/app/services/image_fetcher.py` | Unsplash/Pexels/Pixabay image search (tried in order), downloads to `session_dir` |
| `backend/app/database/db.py` | Async SQLAlchemy engine (asyncpg) — `users` table only |
| `frontend/src/App.css` | Entire design system — CSS variables, all components, responsive breakpoints |
| `frontend/src/components/JobTracker.tsx` | SSE + polling, progress bar, done/error states |
| `frontend/src/components/SlidePreview.tsx` | Slide list sidebar + editor (edit/notes/AI rewrite/reorder) |
| `frontend/src/components/PresentationHistory.tsx` | Per-user history list — **requires the `token` prop** from `App.tsx`; it was missing entirely until this was fixed, which silently 401'd every history/delete request |

---

## Deployment (AWS EC2)

- Runs as its own systemd service (`pptgen.service`, single worker) on port 8001, behind
  Nginx alongside kGPT (port 8000) and CaReSale/ClauseGuard on a separate Azure VM
- `frontend/dist/` is committed to git, but the EC2 box also rebuilds it directly on deploy
  (real Node.js available, unlike Heroku's buildpack-only setup)
- Environment variables live in `backend/.env` on the server (not a platform config store)
- `CORS_ORIGINS` is comma-separated (not JSON array) — see Known Quirks below for why
- Shares one Postgres instance on the box with a dedicated `pptgen` database
- Storage (outputs/uploads) lives on the VM's local disk — persists across app restarts,
  but not backed up
- Custom domain: `pptgen.zrik.tech`, DNS A record → the EC2 box's IP, SSL via certbot

### Deploy workflow

```bash
cd frontend && npm run build && cd ..
git add -f frontend/dist/ <changed-source-files>
git commit -m "..."
git push                          # GitHub
# then on the server:
git pull && sudo systemctl restart pptgen
```

---

## Known Quirks

- **Pydantic v2 `CORS_ORIGINS`**: Field type must be `str`, not `List[str]`. v2 JSON-parses list-typed env vars before any `field_validator` runs, so a plain comma-separated value would 400 at startup on a `List[str]` field — parse it manually via the `cors_origins_list` property instead.
- **`VITE_API_URL=/api` is falsy**: Empty string after removing `/api` triggers `||` fallback. Use `!= null` check.
- **Session dir lifetime**: User-uploaded images stay in `uploads/{session_id}/` for up to 1 hour so slide re-renders can embed them. `_cleanup_old_sessions()` removes them on the next generation call. `cleanup_old_outputs()` similarly prunes generated PPTX files older than 1 hour.
- **History is disk-persisted JSON** (`outputs/history.json`), scoped per username. Entries are pruned when their PPTX file no longer exists.
- **`PresentationHistory` needs the `token` prop.** It fetches `/api/history` and `DELETE /api/history/{id}`, both of which require `Authorization: Bearer <token>` — the component doesn't read `localStorage` itself, so if it's ever rendered without `token={token}` from `App.tsx`, every request 401s. This isn't visible as a UI error since the component renders nothing when `history` is empty, so it fails silently — always pass the prop.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `GEMINI_API_KEY` | Yes | Primary Gemini API key |
| `GEMINI_API_KEYS` | No | Comma-separated backup Gemini keys — unbounded |
| `GROQ_API_KEY` | No | Groq key — fallback provider |
| `GROQ_API_KEYS` | No | Comma-separated backup Groq keys — unbounded |
| `JWT_SECRET_KEY` | Yes | Random secret for JWT signing |
| `GROQ_TEXT_MODEL` | No | Default: `openai/gpt-oss-120b` |
| `GROQ_VISION_MODEL` | No | Default: `qwen/qwen3.6-27b` |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `ENVIRONMENT` | No | `development` or `production` |
| `MAX_UPLOAD_SIZE_MB` | No | Default: `10` |
