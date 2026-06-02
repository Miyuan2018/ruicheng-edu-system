"""System LLM configuration API."""
from fastapi import APIRouter, Depends, Body
from app.core.security import get_current_user, require_role
from app.services.config_service import load_config, save_config, fetch_ollama_models, test_llm_connection
from pydantic import BaseModel

router = APIRouter()


class ProviderConfigRequest(BaseModel):
    provider: str  # "ollama" or "deepseek"
    endpoint: str = ""
    model: str = ""
    api_key: str | None = None  # optional, stored in sysconfig.json if provided


@router.get("/config")
async def get_llm_config(current_user=Depends(get_current_user)):
    cfg = load_config()
    llm = cfg.get("llm", {})
    # Strip api_key before sending to frontend
    ds = llm.get("deepseek", {})
    ds["api_key"] = "***" if ds.get("api_key") else ""
    llm["deepseek"] = ds
    return llm


@router.put("/config")
async def update_llm_config(
    req: ProviderConfigRequest,
    current_user=Depends(require_role("SYS_ADMIN")),
):
    cfg = load_config()
    llm = cfg.get("llm", {})
    prov = req.provider

    if prov not in ("ollama", "deepseek"):
        return {"ok": False, "message": f"unknown provider: {prov}"}

    prov_cfg = llm.get(prov, {})
    if prov == "ollama":
        prov_cfg["endpoint"] = req.endpoint or prov_cfg.get("endpoint", "")
        prov_cfg["model"] = req.model or prov_cfg.get("model", "")
        prov_cfg.setdefault("available_models", [])
    else:
        prov_cfg["model"] = req.model or prov_cfg.get("model", "deepseek-chat")
        if req.api_key is not None and req.api_key != "***":
            prov_cfg["api_key"] = req.api_key

    llm[prov] = prov_cfg
    llm["current"] = prov
    cfg["llm"] = llm
    save_config(cfg)
    return {"ok": True, "message": f"{prov} 已设为当前模型，配置已保存"}


class TestRequest(BaseModel):
    provider: str = "ollama"
    endpoint: str | None = None
    model: str | None = None


@router.post("/config/test")
async def test_llm(req: TestRequest = None, current_user=Depends(get_current_user)):
    """Test connection. Handles both Ollama and DeepSeek providers."""
    cfg = load_config()
    llm = cfg.get("llm", {})
    provider = req.provider if req and req.provider else "ollama"

    if provider == "deepseek":
        ds_cfg = llm.get("deepseek", {})
        api_key = ds_cfg.get("api_key", "")
        if not api_key:
            return {"ok": False, "error": "请先在 DeepSeek 配置中填写 API Key"}
        result = await _test_deepseek(api_key)
        if result["ok"]:
            return {"ok": True, "models": ["deepseek-chat", "deepseek-reasoner"],
                    "message": "DeepSeek 连接成功"}
        return result

    # Ollama
    ollama_cfg = llm.get("ollama", {})
    endpoint = (req.endpoint if req and req.endpoint else None) or ollama_cfg.get("endpoint", "http://127.0.0.1:11434/v1")
    model = (req.model if req and req.model else None) or ollama_cfg.get("model", "")

    result = await fetch_ollama_models(endpoint)
    if result["ok"]:
        ollama_cfg["available_models"] = result["models"]
        if req and req.endpoint:
            ollama_cfg["endpoint"] = req.endpoint
        if req and req.model:
            ollama_cfg["model"] = req.model
        cfg["llm"]["ollama"] = ollama_cfg
        save_config(cfg)

        if model and model in result["models"]:
            chat_result = await test_llm_connection(endpoint, model)
            if chat_result.get("ok"):
                return {"ok": True, "models": result["models"],
                        "message": f"连接成功，模型 {model} 可用"}
            return {"ok": True, "models": result["models"],
                    "message": f"发现 {len(result['models'])} 个模型，但 {model} 响应异常"}

        return {"ok": True, "models": result["models"],
                "message": f"发现 {len(result['models'])} 个模型"}

    return {"ok": False, "error": result.get("error", "连接失败")}


async def _test_deepseek(api_key: str) -> dict:
    """Test DeepSeek API connection (Anthropic-compatible endpoint)."""
    import httpx
    cfg = load_config()
    endpoint = cfg.get("llm", {}).get("deepseek", {}).get("endpoint", "https://api.deepseek.com/anthropic/v1/messages")
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0)) as client:
            r = await client.post(
                endpoint,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "deepseek-chat",
                    "max_tokens": 5,
                    "messages": [{"role": "user", "content": "hi"}],
                },
            )
            if r.status_code == 200:
                return {"ok": True}
            err = r.json() if r.text else {}
            return {"ok": False, "error": f"DeepSeek {r.status_code}: {err.get('error',{}).get('message', r.text[:200])}"}
    except httpx.ConnectError:
        return {"ok": False, "error": "无法连接 DeepSeek API (api.deepseek.com)"}
    except Exception as e:
        return {"ok": False, "error": f"连接异常: {str(e)}"}


@router.get("/export-max")
async def get_export_max():
    cfg = load_config()
    return {"export_max": cfg.get("export_max", 200)}

@router.put("/export-max")
async def set_export_max(max_val: int = 200, current_user=Depends(require_role("SYS_ADMIN"))):
    cfg = load_config()
    cfg["export_max"] = max_val
    save_config(cfg)
    return {"export_max": max_val, "message": "已保存"}


@router.put("/section-config")
async def update_section_config(
    payload: dict = Body(...),
    current_user=Depends(require_role("SYS_ADMIN")),
):
    """Save config for a section: grading, ocr, mistake, system."""
    section = payload.pop("section", None)
    if not section:
        return {"message": "missing section"}

    cfg = load_config()
    if section not in ("grading", "ocr", "mistake", "system", "mistake_book", "celery"):
        return {"message": f"unknown section: {section}"}

    key_map = {"mistake": "mistake_book"}
    cfg_key = key_map.get(section, section)

    section_cfg = cfg.get(cfg_key, {})
    for k, v in payload.items():
        if v is None:
            continue
        section_cfg[k] = v
    cfg[cfg_key] = section_cfg
    save_config(cfg)
    return {"message": f"{section} 配置已保存"}


class RedisTestRequest(BaseModel):
    redis_url: str


@router.post("/test-redis")
async def test_redis(
    req: RedisTestRequest,
    current_user=Depends(require_role("SYS_ADMIN")),
):
    """Test Redis connectivity."""
    import redis as redis_lib
    try:
        r = redis_lib.Redis.from_url(req.redis_url, socket_connect_timeout=3)
        r.ping()
        info = r.info("server")
        version = info.get("redis_version", "unknown")
        return {"ok": True, "message": f"Redis 连接成功 (v{version})"}
    except redis_lib.ConnectionError as e:
        return {"ok": False, "message": f"无法连接 Redis: {e}"}
    except Exception as e:
        return {"ok": False, "message": f"Redis 连接异常: {str(e)}"}


@router.get("/all-config")
async def get_all_config(current_user=Depends(get_current_user)):
    require_role("SYS_ADMIN")(current_user)
    cfg = load_config()
    # Strip secrets from full config
    ds = cfg.get("llm", {}).get("deepseek", {})
    ds["api_key"] = "***" if ds.get("api_key") else ""
    return cfg
