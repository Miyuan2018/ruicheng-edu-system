"""Unified API response middleware — wraps all responses in {code, message, data} format."""
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class ApiResponseMiddleware(BaseHTTPMiddleware):
    """Auto-wrap all /api/ responses into {code, message, data} format."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Only wrap API responses
        if not request.url.path.startswith("/api/"):
            return response

        # Skip non-JSON responses
        content_type = response.headers.get("content-type", "")
        if "application/json" not in content_type:
            return response

        # Get response body
        body = b""
        async for chunk in response.body_iterator:
            body += chunk

        import json
        try:
            data = json.loads(body)
        except (json.JSONDecodeError, TypeError):
            return response

        status_code = response.status_code

        # Already wrapped?
        if isinstance(data, dict) and "code" in data and "message" in data and "data" in data:
            # Already in our format, just pass through
            return JSONResponse(content=data, status_code=status_code)

        # HTTP errors: keep backward compat
        if 400 <= status_code < 600:
            detail = data.get("detail", str(data)) if isinstance(data, dict) else str(data)
            wrapped = {"code": status_code, "message": detail, "detail": detail, "data": None}
            return JSONResponse(content=wrapped, status_code=status_code)

        # Success responses: wrap in {code: 200, message: "成功", data: ...}
        wrapped = {"code": 200, "message": "成功", "data": data}
        return JSONResponse(content=wrapped, status_code=200)


def api_response(data=None, message="成功", code=200):
    """Helper to create standardized response."""
    return {"code": code, "message": message, "data": data}


def api_error(message="操作失败", code=400, data=None):
    """Helper to create standardized error response."""
    return {"code": code, "message": message, "data": data}
