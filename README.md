<p align="center">
  <h1 align="center">PptGen</h1>
  <p align="center"><strong>AI Presentation Generator</strong></p>
  <p align="center">
    Describe your topic — AI researches, writes, designs and exports a complete PowerPoint in seconds.
  </p>
  <p align="center">
    <a href="https://pptgen.zrik.tech">
      <img src="https://img.shields.io/badge/Live%20Demo-pptgen.zrik.tech-brightgreen?style=for-the-badge" alt="Live Demo">
    </a>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white" alt="Python">
    <img src="https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white" alt="FastAPI">
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black" alt="React">
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/Gemini-3.1_Flash_Lite-4285F4?style=flat&logo=google&logoColor=white" alt="Gemini">
    <img src="https://img.shields.io/badge/Groq-GPT--OSS_120B-F55036?style=flat" alt="Groq">
    <img src="https://img.shields.io/badge/Heroku-deployed-430098?style=flat&logo=heroku&logoColor=white" alt="Heroku">
    <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat" alt="License">
  </p>
</p>

---

<table>
  <tr>
    <td><img src="docs/screenshots/1-landing-login.png" alt="Landing & login" width="100%"></td>
    <td><img src="docs/screenshots/4-configure-filled.png" alt="Configure presentation" width="100%"></td>
  </tr>
  <tr>
    <td align="center"><em>Landing — auth form with feature highlights</em></td>
    <td align="center"><em>Configure — prompt, templates, themes</em></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/6-generating.png" alt="Generating progress" width="100%"></td>
    <td><img src="docs/screenshots/8-editor.png" alt="Slide editor" width="100%"></td>
  </tr>
  <tr>
    <td align="center"><em>Real-time generation progress</em></td>
    <td align="center"><em>Presentation ready + slide editor</em></td>
  </tr>
</table>

---

## Why I Built This

PptGen was built to eliminate the manual work of creating presentations. Instead of spending hours on slide design and research, you describe your topic and the AI plans the structure, researches current facts via live web search, selects relevant images, and renders a fully editable PowerPoint — end to end in under a minute. The project explores background job queuing, real-time SSE progress streaming, AI-driven slide planning, and PPTX generation with python-pptx.

---

## Features

| # | Feature | Description |
|---|---------|-------------|
| 1 | **AI Content Generation** | Gemini (primary) plans, writes and structures every slide, with Groq GPT-OSS 120B as fallback |
| 2 | **Live Web Research** | DuckDuckGo search automatically pulls current facts into slides |
| 3 | **8 Professional Themes** | Classic, Dark, Corporate, Creative, Nature, Midnight, Sunset, Rose |
| 4 | **Custom Colors** | Override background, accent and text colour on any theme |
| 5 | **Slide Editor** | Edit titles, bullets, speaker notes; reorder or AI-rewrite any slide post-generation |
| 6 | **Image Integration** | Auto-fetches relevant images per slide; user-uploaded images supported |
| 7 | **Instant PPTX Export** | Downloads a fully editable `.pptx` in seconds |
| 8 | **Presentation History** | Per-user history with one-click re-download |
| 9 | **Real-time Progress** | SSE streaming with HTTP polling fallback |
| 10 | **Auth & Security** | JWT + Argon2 password hashing; all write endpoints require auth |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI, Python 3.11+ |
| **Primary LLM** | Google Gemini `gemini-3.1-flash-lite` — content + vision (template style analysis) |
| **Fallback LLM** | Groq `openai/gpt-oss-120b` (content) + `qwen/qwen3.6-27b` (vision) |
| **Presentation** | python-pptx |
| **Database** | PostgreSQL (asyncpg) + async SQLAlchemy |
| **Authentication** | JWT (PyJWT) + Argon2 (pwdlib) |
| **Web search** | DuckDuckGo via `duckduckgo-search` |
| **Image fetching** | Unsplash → Pexels → Pixabay (tried in order, auto-fetch per slide) |
| **Frontend** | React 19 + Vite + TypeScript |
| **Styling** | Pure CSS (design system — Syne + DM Sans fonts) |
| **Deployment** | Heroku (eco dyno, single-process — FastAPI serves React build) |

---

## Architecture

```
Browser
  │
  ├─ GET /               → FastAPI serves frontend/dist/index.html
  ├─ GET /assets/*       → Vite build assets (StaticFiles)
  ├─ GET /outputs/*      → Generated PPTX + images (StaticFiles)
  │
  └─ POST /api/generate
       │
       ├─ Auth: JWT required
       ├─ Rate limit: 5 generations/hour per IP
       ├─ BackgroundTask: run_generation(job_id, req, username)
       │     ├─ Style extraction (from uploaded template or default)
       │     ├─ Web search (optional — DuckDuckGo)
       │     ├─ AI slide planning (Gemini primary, Groq fallback → JSON plan)
       │     ├─ Image fetching (per slide, saved to session_dir)
       │     ├─ PPTX rendering (python-pptx)
       │     └─ History save (username-scoped, disk-persisted)
       │
       └─ GET /api/stream/{job_id}  → SSE progress (1s interval, 6min max)
```

**Slide editing flow:**
- `POST /api/edit-slide` or `/api/reorder-slides` → spawns new `_rerender` background task
- `POST /api/regenerate-slide` → LLM rewrites one slide → `_rerender`
- Each re-render returns a new `job_id`; frontend polls/streams it and swaps the active job

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL (or use Docker Compose)
- [Gemini API key](https://aistudio.google.com/apikey) (free tier — primary provider)
- [Groq API key](https://console.groq.com/keys) (free tier — fallback provider)

### 1. Clone

```bash
git clone https://github.com/krishrakholiya32/PptGen.git
cd PptGen
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://pptgen:pptgen@localhost:5432/pptgen
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_API_KEYS=second_key,third_key           # optional, comma-separated, unbounded
GROQ_API_KEY=your_groq_api_key_here            # optional, fallback provider
GROQ_API_KEYS=second_key,third_key             # optional, comma-separated, unbounded
GROQ_TEXT_MODEL=openai/gpt-oss-120b
GROQ_VISION_MODEL=qwen/qwen3.6-27b
JWT_SECRET_KEY=change-me-to-a-random-secret
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

- App: <http://localhost:5173>
- API docs: <http://localhost:8000/docs>
- Health: <http://localhost:8000/health>

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `GEMINI_API_KEY` | Yes | Primary Gemini API key — slide content + template vision |
| `GEMINI_API_KEYS` | No | Comma-separated backup Gemini keys — unbounded |
| `GROQ_API_KEY` | No | Groq key — fallback after every Gemini key is exhausted |
| `GROQ_API_KEYS` | No | Comma-separated backup Groq keys — unbounded |
| `JWT_SECRET_KEY` | Yes | Random secret for JWT signing |
| `GROQ_TEXT_MODEL` | No | Override text model (default: `openai/gpt-oss-120b`) |
| `GROQ_VISION_MODEL` | No | Override vision model (default: `qwen/qwen3.6-27b`) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `ENVIRONMENT` | No | `development` or `production` |
| `MAX_UPLOAD_SIZE_MB` | No | Max file upload size (default: 10) |

---

## API Reference

All endpoints marked `🔒` require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user, returns JWT |
| `POST` | `/api/auth/login` | Login with email + password, returns JWT |
| `GET`  | `/api/auth/me` 🔒 | Current user info |
| `GET`  | `/api/auth/check` | Check username/email availability |

### Generate

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/generate` 🔒 | Start generation job, returns `job_id` |
| `GET`  | `/api/job/{job_id}` | Poll job status + download URL |
| `GET`  | `/api/stream/{job_id}` | SSE stream — real-time progress |
| `GET`  | `/api/slide-plan/{job_id}` | Get full slide plan JSON |
| `POST` | `/api/edit-slide` | Edit a slide's title/bullets/notes → re-render |
| `POST` | `/api/regenerate-slide` | AI-rewrite one slide → re-render |
| `POST` | `/api/reorder-slides` | Reorder slides → re-render |

### Upload & History

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST`   | `/api/upload` | Upload images or .pptx template |
| `POST`   | `/api/recommend-slides` | AI-recommended slide count for a prompt |
| `GET`    | `/api/history` 🔒 | Per-user presentation history |
| `DELETE` | `/api/history/{job_id}` 🔒 | Delete a history entry |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health + environment |

---

## Project Structure

```
PptGen/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py           # JWT auth — register, login, me, check
│   │   │   ├── generate.py       # Job queue, SSE stream, slide edit/regen/reorder
│   │   │   ├── preview.py        # History API, slide-count recommender, output cleanup
│   │   │   └── upload.py         # File upload (images + .pptx templates)
│   │   ├── core/
│   │   │   └── config.py         # Pydantic settings — env vars
│   │   ├── database/
│   │   │   └── db.py             # Async PostgreSQL + SQLAlchemy engine
│   │   ├── models/
│   │   │   └── user.py           # User ORM model
│   │   ├── services/
│   │   │   ├── content_planner.py  # LLM → structured slide plan JSON
│   │   │   ├── image_fetcher.py    # Unsplash/Pexels/Pixabay image search per slide
│   │   │   ├── llm_service.py      # Gemini primary / Groq fallback LLM wrapper
│   │   │   ├── renderer_pptx.py    # python-pptx slide renderer
│   │   │   ├── style_extractor.py  # Extract theme from uploaded .pptx
│   │   │   └── web_search.py       # DuckDuckGo web search context
│   │   └── main.py               # FastAPI app, CORS, static mounts, catch-all
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthPage.tsx        # Login + register with live validation
│   │   │   ├── ColorCustomizer.tsx # Bg/accent/text colour pickers
│   │   │   ├── JobTracker.tsx      # SSE + polling progress tracker, done state
│   │   │   ├── PresentationHistory.tsx  # Per-user history with re-download
│   │   │   ├── PromptForm.tsx      # Main config form (topic, slides, theme, upload)
│   │   │   ├── SlidePreview.tsx    # Slide list + editor (edit/notes/AI rewrite/reorder)
│   │   │   └── ThemePicker.tsx     # 8 theme cards in 4×2 grid
│   │   ├── App.tsx                 # Root — auth gate, steps bar, token keepalive
│   │   ├── types.ts                # Shared TypeScript interfaces
│   │   └── App.css                 # Full design system (dark SaaS, responsive)
│   ├── .env.production             # VITE_API_URL=/api (relative, same-origin on Heroku)
│   ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
│   └── vite.config.ts
├── docs/
│   └── screenshots/
├── Procfile                        # web: uvicorn app.main:app (served from backend/)
├── .python-version                 # 3.11 (Heroku buildpack)
├── docker-compose.yml
└── README.md
```

---

## Deployment (Heroku)

The app runs as a **single Heroku dyno** — FastAPI serves both the API and the React build:

```
Procfile:  web: sh -c 'cd backend && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}'
```

FastAPI mounts `/assets` and `/outputs` as `StaticFiles` and serves `frontend/dist/index.html` via a catch-all route.

### Deploy your own

```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:essential-0

heroku config:set GEMINI_API_KEY=...
heroku config:set GEMINI_API_KEYS=your_second_key,your_third_key
heroku config:set GROQ_API_KEY=...
heroku config:set GROQ_API_KEYS=your_second_groq_key
heroku config:set GROQ_TEXT_MODEL=openai/gpt-oss-120b
heroku config:set GROQ_VISION_MODEL=qwen/qwen3.6-27b
heroku config:set JWT_SECRET_KEY=...
heroku config:set CORS_ORIGINS=https://your-domain.com
heroku config:set ENVIRONMENT=production

# Build frontend first
cd frontend && npm run build && cd ..
git add -f frontend/dist/
git commit -m "build: production frontend"
git push heroku main
```

Custom domain:
```bash
heroku domains:add pptgen.yourdomain.com
heroku certs:auto:enable
# Add CNAME in your DNS provider pointing to the Heroku DNS target
```

> **Note:** Heroku eco dynos use ephemeral storage. Generated PPTX files and uploaded images are cleaned up after 1 hour. For permanent storage, wire up an S3 bucket.

---

## Roadmap

- [ ] S3/Cloudflare R2 for persistent PPTX storage
- [ ] PDF export alongside PPTX
- [ ] More layout types (timeline, comparison, chart slides)
- [ ] Google Slides export
- [ ] Team / shared presentations

---

## License

[MIT](LICENSE)

---

<p align="center">
  Designed and implemented from scratch with FastAPI · React · Gemini · Groq · Deployed on Heroku
</p>
