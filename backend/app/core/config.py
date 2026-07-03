from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
import sys
import json


class Settings(BaseSettings):
    GROQ_API_KEY: str
    GROQ_API_KEYS: str = ""   # comma-separated extra keys for rotation
    GEMINI_API_KEY: str = ""
    GEMINI_API_KEYS: str = "" # comma-separated extra keys for rotation
    GEMINI_MODEL: str = "gemini-3.1-flash-lite"
    GROQ_TEXT_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_VISION_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"

    @property
    def all_groq_keys(self) -> List[str]:
        keys = [self.GROQ_API_KEY]
        if self.GROQ_API_KEYS:
            keys += [k.strip() for k in self.GROQ_API_KEYS.split(",") if k.strip()]
        return keys

    @property
    def all_gemini_keys(self) -> List[str]:
        keys = [self.GEMINI_API_KEY] if self.GEMINI_API_KEY else []
        if self.GEMINI_API_KEYS:
            keys += [k.strip() for k in self.GEMINI_API_KEYS.split(",") if k.strip()]
        return keys
    UPLOAD_DIR: str = "uploads"
    OUTPUT_DIR: str = "outputs"
    MAX_UPLOAD_SIZE_MB: int = 20
    UNSPLASH_ACCESS_KEY: str = ""
    PEXELS_API_KEY: str = ""
    PIXABAY_API_KEY: str = ""

    # CORS — plain string, comma-separated or JSON array
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost"
    ALLOW_CREDENTIALS: bool = True
    ALLOW_METHODS: str = "*"
    ALLOW_HEADERS: str = "*"

    @property
    def cors_origins_list(self) -> List[str]:
        v = self.CORS_ORIGINS.strip()
        if v.startswith("["):
            try:
                return json.loads(v)
            except Exception:
                pass
        return [o.strip() for o in v.split(",") if o.strip()]

    JWT_SECRET_KEY: str = "pptgen-dev-secret-change-in-prod"
    DATABASE_URL: str = "postgresql+asyncpg://pptgen:pptgen@localhost:5432/pptgen"
    ENVIRONMENT: str = "development"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_db_url(cls, v: str) -> str:
        # Normalize Heroku-style URLs to the async (asyncpg) driver form.
        if not v:
            return "postgresql+asyncpg://pptgen:pptgen@localhost:5432/pptgen"
        if v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v[len("postgres://"):]
        if v.startswith("postgresql://") and "+asyncpg" not in v:
            return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

    class Config:
        env_file = ".env"


try:
    settings = Settings()
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY == "your_groq_api_key_here":
        print("ERROR: GROQ_API_KEY is required and must be set in .env file")
        sys.exit(1)
except Exception as e:
    print(f"ERROR: Failed to load configuration: {e}")
    print("Please ensure .env file exists with required variables")
    sys.exit(1)
