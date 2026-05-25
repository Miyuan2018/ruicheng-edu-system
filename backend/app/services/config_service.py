"""System configuration service — reads/writes sysconfig.json."""
import json
import os
import httpx
from typing import Optional


def _get_deepseek_default_api_key() -> str:
    """Try to read DeepSeek API key from Claude settings files."""
    try:
        for settings_path in [
            os.path.expanduser("~/.claude/settings.local.json"),
            ".claude/settings.local.json",
        ]:
            if os.path.exists(settings_path):
                with open(settings_path) as f:
                    cfg = json.load(f)
                token = cfg.get("env", {}).get("ANTHROPIC_AUTH_TOKEN", "")
                base = cfg.get("env", {}).get("ANTHROPIC_BASE_URL", "")
                if token and "deepseek" in base:
                    return token
    except Exception:
        pass
    return ""


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
        "password": "postgres",
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
            "api_key": _get_deepseek_default_api_key(),
            "model": _get_deepseek_default_model(),
            "available_models": ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-pro[1m]", "deepseek-v4-flash"],
        },
    },
    "grading": {
        "max_concurrent_grading": 1,
        "grading_model": "rule",
    },
    "ocr": {
        "ocr_engine": "paddleocr",
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
}


def load_config() -> dict:
    if not os.path.exists(CONFIG_PATH):
        return DEFAULT_CONFIG.copy()
    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def save_config(config: dict) -> None:
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


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
