from pydantic_settings import BaseSettings
from typing import Optional
import os


def _load_sysconfig():
    """Load config from sysconfig.json (non-sensitive), with env var override for secrets."""
    try:
        import json
        cfg_path = os.path.join(os.path.dirname(__file__), "..", "..", "sysconfig.json")
        with open(cfg_path) as f:
            cfg = json.load(f)
        db = cfg.get("database", {})
        return {
            "secret_key": os.getenv("SECRET_KEY", cfg.get("secret_key", "change-me")),
            "server": db.get("server", "localhost"),
            "port": db.get("port", "5432"),
            "database": db.get("database", "edu_system"),
            "user": db.get("user", "postgres"),
            "password": os.getenv("DATABASE_PASSWORD") or db.get("password") or "postgres",
        }
    except Exception:
        return {
            "secret_key": os.getenv("SECRET_KEY", "change-me"),
            "server": os.getenv("POSTGRES_SERVER", "localhost"),
            "port": os.getenv("POSTGRES_PORT", "5432"),
            "database": os.getenv("POSTGRES_DB", "edu_system"),
            "user": os.getenv("POSTGRES_USER", "postgres"),
            "password": os.getenv("DATABASE_PASSWORD", "postgres"),
        }


_syscfg = _load_sysconfig()


class Settings(BaseSettings):
    # Project settings
    PROJECT_NAME: str = "edu_system"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # Security settings (from sysconfig.json)
    SECRET_KEY: str = _syscfg.get("secret_key", "your-secret-key-here-change-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # PostgreSQL settings (from sysconfig.json)
    POSTGRES_SERVER: str = _syscfg["server"]
    POSTGRES_USER: str = _syscfg["user"]
    POSTGRES_PASSWORD: str = _syscfg["password"]
    POSTGRES_DB: str = _syscfg["database"]
    POSTGRES_PORT: str = _syscfg["port"]

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def ASYNC_DATABASE_URL(self) -> str:
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
    PORT: int = int(os.getenv("BACKEND_PORT", "8001"))

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"


settings = Settings()
