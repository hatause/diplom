from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    JWT_SECRET: str = "secret"  # Default fallback
    REFRESH_TOKEN_SECRET: str = ""  # Falls back to JWT_SECRET if empty

    # Lowercase aliases used by gemini_service.py (httpx-based client)
    @property
    def gemini_api_key(self) -> str:
        return self.GEMINI_API_KEY

    @property
    def gemini_model(self) -> str:
        return self.GEMINI_MODEL

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
