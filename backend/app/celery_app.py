"""Celery application — async task queue for LLM generation and web scraping."""
import os
from celery import Celery

# Broker URL: prefer env var (set by Docker), fallback to sysconfig
_broker_url = os.getenv("CELERY_BROKER_URL")
if not _broker_url:
    try:
        import json
        _cfg_path = os.path.join(os.path.dirname(__file__), "..", "..", "sysconfig.json")
        with open(_cfg_path) as _f:
            _cfg = json.load(_f)
        _broker_url = _cfg.get("celery", {}).get("redis_url", "redis://localhost:6379/0")
    except Exception:
        _broker_url = "redis://localhost:6379/0"

celery = Celery(
    "edu_system",
    broker=_broker_url,
    backend=_broker_url.replace("/0", "/1"),
    include=["app.tasks.llm_tasks"],
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)
