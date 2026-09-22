import json
import logging
from typing import Optional
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select

from app.core.security import decode_access_token
from app.core.websocket_manager import ws_manager
from app.db.session import async_session_factory
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """
    Real-Time WebSocket notification gateway for live ticket state mutations,
    SLA alerts, and multi-department inbox activity.
    """
    if not token:
        logger.warning("[WS] Handshake rejected: No token provided")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Strip optional "Bearer " prefix
    if token.startswith("Bearer "):
        token = token[7:]

    payload = decode_access_token(token)
    if not payload or not payload.get("sub"):
        logger.warning("[WS] Handshake rejected: Invalid or expired JWT token")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    sub_val = str(payload["sub"])

    # Verify user in database by ID or email
    async with async_session_factory() as session:
        if sub_val.isdigit():
            stmt = select(User).where(User.id == int(sub_val), User.is_active == True)
        else:
            stmt = select(User).where(User.email == sub_val, User.is_active == True)
        result = await session.execute(stmt)
        user = result.scalars().first()

        if not user:
            logger.warning(f"[WS] Handshake rejected: User not found for sub '{sub_val}'")
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    # Register active connection
    await ws_manager.connect(websocket, user)

    # Send initial connection confirmation
    await websocket.send_text(
        json.dumps({
            "type": "CONNECTED",
            "message": "Connected to NexusFlow Real-Time Event Stream",
            "user_id": user.id,
            "role": user.role.value if hasattr(user.role, "value") else str(user.role),
            "department_id": user.department_id,
        })
    )

    try:
        while True:
            data = await websocket.receive_text()
            # Handle client heartbeat ping
            try:
                msg = json.loads(data)
                if msg.get("type") == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user)
    except Exception as e:
        logger.warning(f"[WS] Connection error for user {user.id}: {e}")
        ws_manager.disconnect(websocket, user)
