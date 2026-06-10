from pydantic_settings import BaseSettings
from typing import List
import sys

class Settings(BaseSettings):
    GROQ_API_KEY: str
    GEMINI_API_KEY: str = ""
    GROQ_TEXT_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_VISION_MODEL: str = "llama-3.2-11b-vision-preview"
    UPLOAD_DIR: str = "uploads"
    OUTPUT_DIR: str = "outputs"
    MAX_UPLOAD_SIZE_MB: int = 20
    UNSPLASH_ACCESS_KEY: str = ""
    PEXELS_API_KEY: str = ""
    PIXABAY_API_KEY: str = ""
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "https://kpptgen.netlify.app",
        "http://localhost:5173",
        "http://localhost:3000"
    ]
    ALLOW_CREDENTIALS: bool = True
    ALLOW_METHODS: List[str] = ["*"]
    ALLOW_HEADERS: List[str] = ["*"]
    
    # Environment
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"

try:
    settings = Settings()
    # Validate required API key
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY == "your_groq_api_key_here":
        print("ERROR: GROQ_API_KEY is required and must be set in .env file")
        sys.exit(1)
except Exception as e:
    print(f"ERROR: Failed to load configuration: {e}")
    print("Please ensure .env file exists with required variables")
    sys.exit(1)
