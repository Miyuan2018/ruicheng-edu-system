"""Unified API response middleware — wraps all responses in {code, message, data} format.

Uses pure ASGI middleware to avoid body_iterator issues with BaseHTTPMiddleware.
Sends wrapped responses directly via send() instead of JSONResponse to avoid
receive channel exhaustion issues.
"""
import json
import logging
from starlette.types import ASGIApp, Receive, Scope, Send

logger = logging.getLogger(__name__)


class ApiResponseMiddleware:
    """ASGI middleware that auto-wraps all /api/ responses into {code, message, data} format."""

    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        if not path.startswith("/api/"):
            await self.app(scope, receive, send)
            return

        status_code = 200
        headers = []
        body_parts = []
        response_started = False

        async def send_wrapper(message):
            nonlocal status_code, headers, body_parts, response_started

            if message["type"] == "http.response.start":
                response_started = True
                status_code = message["status"]
                headers = list(message.get("headers", []))
                return

            if message["type"] == "http.response.body":
                body_parts.append(message.get("body", b""))
                if message.get("more_body", False):
                    return

                # Full body received — try to wrap it
                full_body = b"".join(body_parts)
                try:
                    content_type = ""
                    for name, value in headers:
                        if name == b"content-type":
                            content_type = value.decode("latin-1", errors="replace")
                            break

                    if "application/json" not in content_type:
                        await _send_raw(send, status_code, headers, full_body)
                        return

                    data = json.loads(full_body)

                    # Already wrapped?
                    if isinstance(data, dict) and "code" in data and "message" in data and "data" in data:
                        await _send_raw(send, status_code, headers, full_body)
                        return

                    # Wrap the response
                    if 400 <= status_code < 600:
                        detail = data.get("detail", str(data)) if isinstance(data, dict) else str(data)
                        wrapped = {"code": status_code, "message": detail, "detail": detail, "data": None}
                    else:
                        wrapped = {"code": 200, "message": "成功", "data": data}
                        status_code = 200

                    wrapped_body = json.dumps(wrapped, ensure_ascii=False).encode("utf-8")
                    await _send_raw(
                        send,
                        status_code,
                        [(b"content-type", b"application/json")],
                        wrapped_body,
                    )
                except Exception:
                    logger.exception("ApiResponseMiddleware wrapping error")
                    await _send_raw(send, status_code, headers, full_body)
                return

            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            logger.exception("Unhandled exception in ApiResponseMiddleware")
            if not response_started:
                err_body = json.dumps(
                    {"code": 500, "message": "Internal Server Error", "data": None},
                    ensure_ascii=False,
                ).encode("utf-8")
                await _send_raw(send, 500, [(b"content-type", b"application/json")], err_body)


async def _send_raw(send, status_code, headers, body):
    """Send a raw HTTP response via ASGI send()."""
    await send({
        "type": "http.response.start",
        "status": status_code,
        "headers": headers,
    })
    await send({
        "type": "http.response.body",
        "body": body,
    })


def api_response(data=None, message="成功", code=200):
    """Helper to create standardized response."""
    return {"code": code, "message": message, "data": data}


def api_error(message="操作失败", code=400, data=None):
    """Helper to create standardized error response."""
    return {"code": code, "message": message, "data": data}
