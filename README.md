# PptGen - AI Presentation Generator

A full-stack application that uses AI to generate PowerPoint presentations from text prompts.

## Features

- AI-powered content generation using Groq API
- Customizable themes and colors
- Image integration from multiple sources (Unsplash, Pexels, Pixabay)
- Template-based style extraction
- Web search integration for current facts
- Real-time job tracking
- Presentation history

## Tech Stack

### Frontend
- React 19
- Vite
- Modern CSS

### Backend
- FastAPI
- Python 3.12
- python-pptx for presentation generation
- Groq API for AI content generation

## Prerequisites

- Docker and Docker Compose
- Python 3.12+ (for local development)
- Node.js 20+ (for local development)
- Groq API Key ([Get one here](https://console.groq.com/))

## Quick Start with Docker

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd PptGen
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   ```
   GROQ_API_KEY=your_actual_groq_api_key_here
   ```

3. **Build and run with Docker Compose**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Frontend: http://localhost
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs
   - Health Check: http://localhost:8000/health

## Local Development

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**
   ```bash
   cp ../.env.example .env
   # Edit .env with your API keys
   ```

5. **Run the backend**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the frontend**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:5173

## Building for Production

### Frontend
```bash
cd frontend
npm run build
```

The production build will be in the `dist/` directory.

### Backend
The backend is production-ready with the following features:
- Structured logging
- Health check endpoint
- Environment-based configuration
- CORS configuration
- Error handling for missing API keys

## Docker Deployment

### Build individual containers

**Backend:**
```bash
docker build -t pptgen-backend ./backend
```

**Frontend:**
```bash
docker build -t pptgen-frontend ./frontend
```

### Run with Docker Compose

```bash
docker-compose up -d
```

### View logs
```bash
docker-compose logs -f
```

### Stop services
```bash
docker-compose down
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key for AI content generation |
| `GEMINI_API_KEY` | No | Google Gemini API key (optional) |
| `UNSPLASH_ACCESS_KEY` | No | Unsplash API key for images |
| `PEXELS_API_KEY` | No | Pexels API key for images |
| `PIXABAY_API_KEY` | No | Pixabay API key for images |
| `GROQ_TEXT_MODEL` | No | Groq text model (default: llama-3.3-70b-versatile) |
| `GROQ_VISION_MODEL` | No | Groq vision model (default: llama-3.2-11b-vision-preview) |
| `CORS_ORIGINS` | No | Allowed CORS origins (default: localhost) |
| `ENVIRONMENT` | No | Environment (development/production) |

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Generate
- `POST /api/generate` - Generate a presentation
- `GET /api/job/{job_id}` - Get job status
- `GET /api/slide-plan/{job_id}` - Get slide plan
- `POST /api/edit-slide` - Edit a slide
- `POST /api/regenerate-slide` - Regenerate a slide

### Upload
- `POST /api/upload` - Upload files (images, templates)

### Preview
- `GET /api/history` - Get presentation history

## Project Structure

```
PptGen/
├── backend/
│   ├── app/
│   │   ├── api/          # API routes
│   │   ├── core/         # Configuration
│   │   └── services/     # Business logic
│   ├── uploads/          # Temporary upload directory
│   ├── outputs/          # Generated presentations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/           # Static assets
│   ├── package.json
│   ├── vite.config.js
│   ├── nginx.conf
│   └── Dockerfile
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

## Troubleshooting

### Backend fails to start
- Ensure `.env` file exists with `GROQ_API_KEY` set
- Check that port 8000 is not in use
- Verify Python dependencies are installed

### Frontend cannot connect to backend
- Ensure backend is running on port 8000
- Check CORS configuration in `.env`
- Verify proxy settings in `vite.config.js`

### Docker issues
- Ensure Docker and Docker Compose are installed
- Check that ports 80 and 8000 are not in use
- Run `docker-compose down` before rebuilding

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
