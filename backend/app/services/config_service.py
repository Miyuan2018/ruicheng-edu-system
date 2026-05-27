"""System configuration service — reads/writes sysconfig.json.

Sensitive values (SECRET_KEY, DATABASE_PASSWORD, DEEPSEEK_API_KEY) are
loaded from environment variables, NOT stored in sysconfig.json.
"""

import json
import os
import httpx
from typing import Optional


def _get_deepseek_api_key() -> str:
    """Get DeepSeek API key from environment variable."""
    return os.getenv("DEEPSEEK_API_KEY", "")


def _get_deepseek_default_model() -> str:
    """Default DeepSeek model for native API."""
    return "deepseek-chat"

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "sysconfig.json")

DEFAULT_CONFIG = {
    "database": {
        "server": "localhost",
        "port": "5432",
        "database": "edu_system",
        "user": "postgres",
    },
    "llm": {
        "current": "ollama",
        "ollama": {
            "endpoint": "http://127.0.0.1:11434/v1",
            "model": "",
            "available_models": [],
        },
        "deepseek": {
            "endpoint": "https://api.deepseek.com/anthropic/v1/messages",
            "api_key": "",  # loaded from DEEPSEEK_API_KEY env var at runtime
            "model": _get_deepseek_default_model(),
            "available_models": ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-pro[1m]", "deepseek-v4-flash"],
        },
    },
    "grading": {
        "max_concurrent_grading": 1,
        "grading_model": "rule",
    },
    "ocr": {
        "ocr_engine": "tesseract",
        "paddleocr_endpoint": "http://paddleocr:8080/predict",
        "max_concurrent_ocr": 5,
        "ocr_confidence_threshold": 0.8,
    },
    "mistake_book": {
        "practice_question_count": 5,
    },
    "export_max": 200,
    "system": {
        "log_level": "INFO",
        "backup_enabled": False,
    },
    "celery": {
        "enabled": False,
        "redis_url": "redis://localhost:6379/0",
        "worker_concurrency": 2,
        "async_threshold": 3,
    },
}


def load_config() -> dict:
    """Load config from sysconfig.json, injecting secrets from env vars."""
    if not os.path.exists(CONFIG_PATH):
        cfg = DEFAULT_CONFIG.copy()
    else:
        with open(CONFIG_PATH, "r") as f:
            cfg = json.load(f)

    # Inject secrets from environment variables (never stored in JSON)
    ds = cfg.get("llm", {}).get("deepseek", {})
    ds["api_key"] = _get_deepseek_api_key()
    # Database password is handled by config.py via DATABASE_PASSWORD env var

    return cfg


_SENSITIVE_KEYS = {
    ("llm", "deepseek", "api_key"),
    ("database", "password"),
}


def _strip_secrets(config: dict) -> dict:
    """Remove sensitive fields before writing to file."""
    cfg = json.loads(json.dumps(config))  # deep copy
    for path in _SENSITIVE_KEYS:
        d = cfg
        for key in path[:-1]:
            if key not in d:
                return cfg
            d = d[key]
        if path[-1] in d:
            d[path[-1]] = ""
    return cfg


def save_config(config: dict) -> None:
    """Save config to sysconfig.json, stripping secrets first."""
    safe = _strip_secrets(config)
    with open(CONFIG_PATH, "w") as f:
        json.dump(safe, f, indent=2, ensure_ascii=False)


async def fetch_ollama_models(endpoint: str) -> dict:
    """Fetch available models from Ollama API."""
    base = endpoint.rstrip("/").replace("/v1", "").replace("/v1/", "")
    url = f"{base}/api/tags"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
            r = await client.get(url, follow_redirects=True)
            if r.status_code == 200:
                data = r.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                return {"ok": True, "models": models}
            return {"ok": False, "error": f"Ollama returned {r.status_code}: {r.text[:200]}"}
    except httpx.ConnectError as e:
        return {"ok": False, "error": f"无法连接Ollama({url}): 请确认Ollama服务已启动"}
    except httpx.TimeoutException:
        return {"ok": False, "error": f"连接Ollama超时({url})"}
    except Exception as e:
        return {"ok": False, "error": f"连接异常: {str(e)}"}


async def test_llm_connection(endpoint: str, model: str) -> dict:
    """Test connection + warm up model with a lightweight generate call."""
    result = await fetch_ollama_models(endpoint)
    if not result["ok"]:
        return result
    if model and model not in result["models"]:
        return {"ok": False, "error": "模型 " + model + " 不在可用列表中", "models": result["models"]}

    # Warm up: send a minimal prompt to trigger model loading
    base = endpoint.rstrip("/").replace("/v1", "")
    url = base + "/api/generate"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=5.0)) as client:
            r = await client.post(url, json={
                "model": model,
                "prompt": "hi",
                "stream": False,
                "options": {"num_predict": 2, "temperature": 0},
            })
            if r.status_code == 200:
                return {"ok": True, "models": result["models"],
                        "message": "模型 " + model + " 加载成功，可以使用"}
            return {"ok": False, "error": "模型响应异常: " + r.text[:200], "models": result["models"]}
    except httpx.TimeoutException:
        return {"ok": False, "error": "模型加载超时(300s)，请检查Ollama状态", "models": result["models"]}
    except Exception as e:
        return {"ok": False, "error": "连接异常: " + str(e), "models": result["models"]}
