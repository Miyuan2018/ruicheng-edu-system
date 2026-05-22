"""System LLM configuration API."""
from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user, require_role
from app.services.config_service import load_config, save_config, fetch_ollama_models, test_llm_connection
from pydantic import BaseModel

router = APIRouter()


class LlmConfigRequest(BaseModel):
    provider: str = "ollama"
    endpoint: str = "http://127.0.0.1:11434/v1"
    model: str = ""


@router.get("/config")
async def get_llm_config(current_user=Depends(get_current_user)):
    cfg = load_config()
    return cfg.get("llm", {})


@router.put("/config")
async def update_llm_config(
    req: LlmConfigRequest,
    current_user=Depends(require_role("SYS_ADMIN")),
):
    cfg = load_config()
    cfg["llm"] = {
        "provider": req.provider,
        "endpoint": req.endpoint,
        "model": req.model,
        "available_models": cfg.get("llm", {}).get("available_models", []),
    }
    save_config(cfg)
    return {"ok": True, "message": "配置已保存"}


class TestRequest(BaseModel):
    endpoint: str | None = None
    model: str | None = None

@router.post("/config/test")
async def test_llm(req: TestRequest = None, current_user=Depends(get_current_user)):
    """Test connection. Uses endpoint from request > config. If model provided, test chat with that model."""
    cfg = load_config()
    if req and req.endpoint:
        endpoint = req.endpoint
    else:
        endpoint = cfg.get("llm", {}).get("endpoint", "http://127.0.0.1:11434/v1")
    model = (req and req.model) or cfg.get("llm", {}).get("model", "")

    # Fetch available models
    result = await fetch_ollama_models(endpoint)
    if result["ok"]:
        cfg["llm"]["available_models"] = result["models"]
        if req and req.endpoint:
            cfg["llm"]["endpoint"] = req.endpoint
        if req and req.model:
            cfg["llm"]["model"] = req.model
        save_config(cfg)

        # If model specified, test chat
        if model and model in result["models"]:
            chat_result = await test_llm_connection(endpoint, model)
            if chat_result.get("ok"):
                return {"ok": True, "models": result["models"],
                        "message": f"连接成功，模型 {model} 可用"}
            return {"ok": True, "models": result["models"],
                    "message": f"发现 {len(result['models'])} 个模型，但 {model} 响应异常: {chat_result.get('error','')}"}

        return {"ok": True, "models": result["models"],
                "message": f"发现 {len(result['models'])} 个模型"}

    return {"ok": False, "error": result.get("error", "连接失败")}


@router.post("/config/test-chat")
async def test_llm_chat(current_user=Depends(require_role("SYS_ADMIN"))):
    """Test chat completion with current model."""
    cfg = load_config()
    llm = cfg.get("llm", {})
    endpoint = llm.get("endpoint", "http://127.0.0.1:11434/v1")
    model = llm.get("model", "")

    if not model:
        return {"ok": False, "error": "请先选择模型"}

    result = await test_llm_connection(endpoint, model)
    return result

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
