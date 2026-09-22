import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketConnectionManager:
    """
    Manages active WebSocket connections with role & department scoping.
    Ensures real-time notifications respect department isolation boundaries.
    """

    def __init__(self):
        # user_id -> Set of active WebSocket instances (user can have multiple tabs)
        self.user_connections: Dict[int, Set[WebSocket]] = {}
        # user_id -> department_id
        self.user_departments: Dict[int, Optional[int]] = {}
        # user_id -> role name ("ADMIN", "AUTHORIZER", etc.)
        self.user_roles: Dict[int, str] = {}
        # department_id -> Set of user_ids
        self.department_users: Dict[int, Set[int]] = {}

    async def connect(self, websocket: WebSocket, user: Any):
        """Register client WebSocket connection for a verified user."""
        await websocket.accept()
        user_id = user.id
        dept_id = user.department_id
        role_str = user.role.value if hasattr(user.role, "value") else str(user.role)

        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()

        self.user_connections[user_id].add(websocket)
        self.user_departments[user_id] = dept_id
        self.user_roles[user_id] = role_str

        if dept_id is not None:
            if dept_id not in self.department_users:
                self.department_users[dept_id] = set()
            self.department_users[dept_id].add(user_id)

        logger.info(
            f"[WS] Client connected: user_id={user_id} ({user.email}), role={role_str}, "
            f"dept={dept_id}. Active sockets for user: {len(self.user_connections[user_id])}"
        )

    def disconnect(self, websocket: WebSocket, user: Any):
        """Unregister client connection on disconnect."""
        user_id = user.id
        dept_id = user.department_id

        if user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
                self.user_departments.pop(user_id, None)
                self.user_roles.pop(user_id, None)
                if dept_id and dept_id in self.department_users:
                    self.department_users[dept_id].discard(user_id)
                    if not self.department_users[dept_id]:
                        del self.department_users[dept_id]

        logger.info(f"[WS] Client disconnected: user_id={user_id}")

    async def broadcast_to_user(self, user_id: int, payload: Dict[str, Any]):
        """Send message specifically to a user's active sockets."""
        sockets = self.user_connections.get(user_id, set())
        if not sockets:
            return

        message_text = json.dumps(payload, default=str)
        dead_sockets = set()

        for ws in list(sockets):
            try:
                await ws.send_text(message_text)
            except Exception as e:
                logger.warning(f"[WS] Failed sending to user {user_id}: {e}")
                dead_sockets.add(ws)

        for dead in dead_sockets:
            sockets.discard(dead)

    async def broadcast_to_department(
        self, department_id: Optional[int], payload: Dict[str, Any], include_admins: bool = True
    ):
        """
        Broadcast to all users in a specific department queue + all active Super Admins.
        Enforces strict department isolation boundaries.
        """
        target_user_ids: Set[int] = set()

        if department_id and department_id in self.department_users:
            target_user_ids.update(self.department_users[department_id])

        if include_admins:
            for u_id, role in self.user_roles.items():
                if role == "ADMIN":
                    target_user_ids.add(u_id)

        tasks = [self.broadcast_to_user(u_id, payload) for u_id in target_user_ids]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_global(self, payload: Dict[str, Any], exclude_user_id: Optional[int] = None):
        """Send payload to every active connected user."""
        tasks = []
        for u_id in list(self.user_connections.keys()):
            if exclude_user_id and u_id == exclude_user_id:
                continue
            tasks.append(self.broadcast_to_user(u_id, payload))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def emit_ticket_event(
        self,
        event_type: str,
        ticket: Any,
        message: str,
        actor: Optional[Any] = None,
        department_code: Optional[str] = None,
        is_internal: bool = False,
    ):
        """
        Structured event broadcaster for ticket lifecycle events.
        Automatically notifies creator, assignee, department queue, and admins.
        """
        priority_val = (
            ticket.priority.value if hasattr(ticket.priority, "value") else str(ticket.priority)
        )
        state_val = (
            ticket.current_state.value
            if hasattr(ticket.current_state, "value")
            else str(ticket.current_state)
        )
        actor_name = actor.full_name if actor else "System Automation"

        payload = {
            "type": event_type,
            "ticket_id": ticket.id,
            "ticket_number": ticket.ticket_number,
            "title": ticket.title,
            "department_id": ticket.department_id,
            "department_code": department_code or getattr(ticket.department, "code", "IT"),
            "priority": priority_val,
            "state": state_val,
            "message": message,
            "actor_name": actor_name,
            "is_internal": is_internal,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # If internal staff note: send only to department staff + admins (do not send to requester)
        if is_internal:
            await self.broadcast_to_department(
                ticket.department_id, payload, include_admins=True
            )
        else:
            # Send to department queue + admins
            await self.broadcast_to_department(
                ticket.department_id, payload, include_admins=True
            )
            # Also ensure ticket creator gets notified even if outside the department
            if ticket.creator_id:
                await self.broadcast_to_user(ticket.creator_id, payload)


# Global WebSocket connection manager singleton
ws_manager = WebSocketConnectionManager()
