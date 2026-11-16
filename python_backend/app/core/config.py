import os
from pathlib import Path
from pydantic import model_validator
from pydantic_settings import BaseSettings

try:
    from dotenv import load_dotenv
    _HAS_DOTENV = True
except ImportError:
    _HAS_DOTENV = False

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BACKEND_DIR.parent
UPLOAD_DIR = BACKEND_DIR / "uploads"

# Автоматически загружаем .env из папки python_backend и корня проекта
if _HAS_DOTENV:
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv(ROOT_DIR / ".env")
    load_dotenv()



class Settings(BaseSettings):
    AI_TIMEOUT_SECONDS: float = 90.0
    CORS_ORIGIN: str = "http://localhost:5173,http://127.0.0.1:5173"
    NODE_ENV: str = "development"
    SCHOOL_TIMEZONE: str = "Asia/Almaty"
    CAMERA_SERVICE_URL: str = ""
    CAMERA_SERVICE_TOKEN: str = ""
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://aitutor:aitutor_secret@localhost:5433/aitutor?schema=public",
    )
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "secret")  # Default fallback
    REFRESH_TOKEN_SECRET: str = os.getenv("REFRESH_TOKEN_SECRET", "")  # Falls back to JWT_SECRET if empty

    # Free classroom search: Java bridge server (team-ENERGO schedule-server), which calls the C++ engine
    ROOM_FINDER_JAVA_URL: str = ""  # e.g. http://localhost:3333
    ROOM_FINDER_API_KEY: str = ""
    ROOM_FINDER_TIMEOUT_SECONDS: float = 12.0
    ROOM_FINDER_MAX_CONCURRENCY: int = 10

    @model_validator(mode="after")
    def production_signing_keys(self):
        if self.NODE_ENV.lower() == "production":
            placeholders = {"secret", "change-me-to-a-random-64-char-string",
                            "change-me-to-another-random-64-char-string"}
            keys = [self.JWT_SECRET, self.REFRESH_TOKEN_SECRET or self.JWT_SECRET]
            if any(len(key.strip()) < 32 or key.strip() in placeholders for key in keys):
                raise ValueError("Production JWT signing keys must be random strings of at least 32 characters")
        return self

    # Lowercase aliases used by gemini_service.py (httpx-based client)
    @property
    def gemini_api_key(self) -> str:
        return self.GEMINI_API_KEY

    @property
    def gemini_model(self) -> str:
        return self.GEMINI_MODEL

    class Config:
        env_file = [str(BACKEND_DIR / ".env"), str(ROOT_DIR / ".env"), ".env"]
        extra = "ignore"
        hide_input_in_errors = True


settings = Settings()
