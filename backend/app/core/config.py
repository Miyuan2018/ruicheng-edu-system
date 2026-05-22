from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    # Project settings
    PROJECT_NAME: str = "edu_system"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Security settings
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Database settings
    DATABASE_TYPE: str = os.getenv("DATABASE_TYPE", "postgresql")  # postgresql or sqlite

    # PostgreSQL settings (used when DATABASE_TYPE=postgresql)
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "edu_system")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")

    # SQLite settings (used when DATABASE_TYPE=sqlite)
    SQLITE_DB_PATH: str = os.getenv("SQLITE_DB_PATH", "./edu_system.db")

    @property
    def DATABASE_URL(self) -> str:
        if self.DATABASE_TYPE.lower() == "sqlite":
            return f"sqlite:///{self.SQLITE_DB_PATH}"
        else:
            return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        if self.DATABASE_TYPE.lower() == "sqlite":
            return f"sqlite+aiosqlite:///{self.SQLITE_DB_PATH}"
        else:
            return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Redis settings
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD", None)

    @property
    def REDIS_URL(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # Celery settings
    CELERY_BROKER_URL: str = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND: str = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

    # File upload settings
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB

    # OCR settings
    OCR_ENGINE: str = os.getenv("OCR_ENGINE", "paddleocr")
    OCR_LANG: str = os.getenv("OCR_LANG", "ch")

    # Model settings
    MODEL_CACHE_DIR: str = os.getenv("MODEL_CACHE_DIR", "./models")

    HOST: str = "0.0.0.0"
    PORT: int = 8000

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"


settings = Settings()