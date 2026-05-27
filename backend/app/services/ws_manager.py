import asyncio
import logging
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketManager:
    """
    Manages active WebSocket connections per user.
    A single user may have multiple tabs/devices connected simultaneously.
    All public methods are coroutine-safe via asyncio.Lock.
    """

    def __init__(self) -> None:
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        """Accept the WebSocket and register it under *user_id*."""
        await ws.accept()
        async with self._lock:
            self._connections[user_id].add(ws)
        logger.info("WS connected: user=%s (total tabs=%d)", user_id, len(self._connections[user_id]))

    async def disconnect(self, user_id: str, ws: WebSocket) -> None:
        """Remove a single WebSocket connection; clean up the user entry when empty."""
        async with self._lock:
            conns = self._connections.get(user_id)
            if conns:
                conns.discard(ws)
                if not conns:
                    del self._connections[user_id]
        logger.info("WS disconnected: user=%s", user_id)

    async def send_to_user(self, user_id: str, data: dict) -> None:
        """Push a JSON payload to every active connection of *user_id*."""
        async with self._lock:
            conns = list(self._connections.get(user_id, []))

        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)

        # Prune broken connections discovered during send
        if dead:
            async with self._lock:
                conns_set = self._connections.get(user_id)
                if conns_set:
                    for ws in dead:
                        conns_set.discard(ws)
                    if not conns_set:
                        del self._connections[user_id]

    async def broadcast(self, data: dict) -> None:
        """Send a JSON payload to every connected user (use sparingly)."""
        async with self._lock:
            snapshot = {uid: list(ws_set) for uid, ws_set in self._connections.items()}

        for uid, conns in snapshot.items():
            await self.send_to_user(uid, data)


# Module-level singleton — import this wherever you need to push messages.
ws_manager = WebSocketManager()
