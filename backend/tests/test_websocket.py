"""Tests for WebSocket endpoint and ConnectionManager."""

import json
import pytest
from unittest.mock import AsyncMock, MagicMock

from websocket import ConnectionManager


class TestWebSocket:
    def test_connect(self, client):
        with client.websocket_connect("/ws") as ws:
            assert ws is not None


class TestConnectionManager:
    @pytest.mark.asyncio
    async def test_connect_and_disconnect(self):
        mgr = ConnectionManager()
        ws = MagicMock()
        ws.accept = AsyncMock()
        await mgr.connect(ws)
        assert len(mgr.active_connections) == 1
        mgr.disconnect(ws)
        assert len(mgr.active_connections) == 0

    @pytest.mark.asyncio
    async def test_broadcast(self):
        mgr = ConnectionManager()
        ws = MagicMock()
        ws.accept = AsyncMock()
        ws.send_text = AsyncMock()
        await mgr.connect(ws)
        await mgr.broadcast("test_event", {"key": "value"})
        ws.send_text.assert_called_once()
        msg = json.loads(ws.send_text.call_args[0][0])
        assert msg["event"] == "test_event"
        assert msg["data"]["key"] == "value"

    @pytest.mark.asyncio
    async def test_broadcast_multiple_clients(self):
        mgr = ConnectionManager()
        ws1, ws2 = MagicMock(), MagicMock()
        ws1.accept = ws2.accept = AsyncMock()
        ws1.send_text = ws2.send_text = AsyncMock()
        await mgr.connect(ws1)
        await mgr.connect(ws2)
        await mgr.broadcast("event", {})
        assert ws1.send_text.called
        assert ws2.send_text.called

    @pytest.mark.asyncio
    async def test_dead_connection_cleanup(self):
        mgr = ConnectionManager()
        ws_good, ws_dead = MagicMock(), MagicMock()
        ws_good.accept = ws_dead.accept = AsyncMock()
        ws_good.send_text = AsyncMock()
        ws_dead.send_text = AsyncMock(side_effect=Exception("Connection closed"))
        await mgr.connect(ws_good)
        await mgr.connect(ws_dead)
        assert len(mgr.active_connections) == 2
        await mgr.broadcast("event", {})
        # Dead connection should be removed
        assert len(mgr.active_connections) == 1
        assert ws_good in mgr.active_connections
