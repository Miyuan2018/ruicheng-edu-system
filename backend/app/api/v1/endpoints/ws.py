import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_token
from app.services.ws_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket) -> None:
    """
    WebSocket endpoint for real-time notification push.

    Client connects to:  ws(s)://host/api/v1/ws/notifications?token=<JWT>
    Protocol:
      - Server sends JSON messages for new notifications.
      - Client may send the text "ping"; server replies "pong" (heartbeat).
      - Connection is closed with code 4001 if the token is missing/invalid.
    """
    token = websocket.query_params.get("token", "")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    payload = decode_token(token)
    user_id: str | None = payload.get("sub")
    if not user_id:
        await websocket.close(code=4001, reason="Invalid token")
        return

    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            # Keep the connection alive; respond to client-side heartbeat pings.
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(user_id, websocket)
