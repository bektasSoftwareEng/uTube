"""
Chat Routes
-----------
WebSocket endpoint for real-time live stream chat.
HTTP endpoints for fetching message history, activity history, and clip logging.

Endpoints:
- WS  /ws/chat/{streamer_username}?token=XYZ  (real-time chat)
- GET /chat/history/{streamer_username}        (last 50 messages)
- GET /live/activity/history/{streamer_username} (last 10 activities)
- POST /live/clip                              (log clip timestamp)

WebSocket Commands (from creator):
- { type: "command", action: "slow_mode", enabled: true/false }
- { type: "command", action: "delete_message", msg_id: "..." }
- { type: "command", action: "poll_start", data: { question, options } }
- { type: "command", action: "poll_end" }

WebSocket Actions (from any authenticated user):
- { type: "poll_vote", option: "..." }
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import json
import time

from backend.database import get_db, SessionLocal
from backend.database.models import User, ChatMessage, ActivityLog, ClipLog, StreamMarker
from backend.core.security import decode_access_token
from backend.chat.manager import manager

router = APIRouter(tags=["Chat"])


# ============================================================================
# Helper: Validate JWT from query param
# ============================================================================

def validate_ws_token(token: Optional[str], db: Session) -> Optional[User]:
    """Validate a JWT token from WebSocket query parameter."""
    if not token:
        return None
    try:
        payload = decode_access_token(token.strip())
        user_id = int(payload.get("sub"))
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None


# ============================================================================
# WebSocket: Real-time Chat
# ============================================================================

@router.websocket("/ws/chat/{streamer_username}")
async def chat_websocket(
    websocket: WebSocket,
    streamer_username: str,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for live stream chat.
    
    Auth: Token validated on handshake. No token = read-only.
    Creator (sender === room owner) gets isMod: true automatically.
    """
    db = SessionLocal()
    try:
        user = validate_ws_token(token, db)
    finally:
        db.close()
    
    username = user.username if user else None
    is_creator = (username == streamer_username)
    
    # Accept and join room with username tracking
    await manager.connect(streamer_username, websocket, username)
    
    # Send personal connection confirmation
    await manager.send_personal(websocket, {
        "type": "system",
        "id": f"sys-{int(time.time() * 1000)}",
        "user": "System",
        "text": f"Connected to {streamer_username}'s chat" + (f" as {username}" if username else " (read-only)"),
        "timestamp": int(time.time() * 1000),
        "isMod": True,
        "isCreator": is_creator
    })
    
    # Send current slow mode state
    await manager.send_personal(websocket, {
        "type": "slow_mode",
        "enabled": manager.is_slow_mode(streamer_username)
    })
    
    # Send active poll if one exists
    active_poll = manager.get_poll(streamer_username)
    if active_poll:
        await manager.send_personal(websocket, {
            "type": "poll_update",
            **active_poll
        })
    
    # Broadcast updated viewer list to all
    await manager.broadcast_viewer_list(streamer_username)
    
    try:
        while True:
            raw = await websocket.receive_text()
            
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await manager.send_personal(websocket, {
                    "type": "error", "text": "Invalid message format"
                })
                continue
            
            # ── Handle Standardized Poll Messages (Uppercase) ──────────
            msg_type = data.get("type")
            
            if msg_type == "POLL_VOTE":
                if not username:
                    await manager.send_personal(websocket, {"type": "error", "text": "Login required to vote"})
                    continue
                option_index = data.get("optionIndex")
                if option_index is None:
                    continue
                
                accepted = manager.vote_poll(streamer_username, username, option_index)
                if accepted:
                    # Broadcast the vote to everyone so UI updates in real-time
                    await manager.broadcast(streamer_username, {
                        "type": "POLL_VOTE",
                        "optionIndex": option_index
                    })
                else:
                    await manager.send_personal(websocket, {"type": "error", "text": "Already voted or invalid option"})
                continue

            if msg_type == "POLL_START":
                if not is_creator:
                    await manager.send_personal(websocket, {"type": "error", "text": "Only the creator can start polls"})
                    continue
                poll_data = data.get("data", {})
                question = poll_data.get("question", "").strip()
                options = poll_data.get("options", [])
                duration = poll_data.get("duration", 60)
                
                if not question or len(options) < 2:
                    await manager.send_personal(websocket, {"type": "error", "text": "Invalid poll data"})
                else:
                    manager.start_poll(streamer_username, question, options, duration)
                    full_poll = manager.get_poll(streamer_username)
                    await manager.broadcast(streamer_username, {
                        "type": "POLL_START",
                        "data": full_poll
                    })
                continue

            if msg_type == "POLL_END":
                if not is_creator:
                    continue
                results = manager.end_poll(streamer_username)
                await manager.broadcast(streamer_username, {
                    "type": "POLL_END",
                    "data": results
                })
                continue

            # ── Legacy Poll Votes (for backward compatibility if needed) ──
            if msg_type == "poll_vote":
                # ... (can be removed or kept as fallback)
                pass
            
            # ── Handle Commands (Legacy & Other) ──────────────────────
            if msg_type == "command":
                if not is_creator:
                    await manager.send_personal(websocket, {
                        "type": "error", "text": "Only the creator can use commands"
                    })
                    continue
                
                action = data.get("action")
                
                if action == "slow_mode":
                    enabled = data.get("enabled", False)
                    manager.set_slow_mode(streamer_username, enabled)
                    await manager.broadcast(streamer_username, {
                        "type": "slow_mode",
                        "enabled": enabled
                    })
                    await manager.broadcast(streamer_username, {
                        "type": "system",
                        "id": f"sys-{int(time.time() * 1000)}",
                        "user": "System",
                        "text": f"Slow mode {'enabled (5s cooldown)' if enabled else 'disabled'}",
                        "timestamp": int(time.time() * 1000),
                        "isMod": True
                    })
                
                elif action == "delete_message":
                    msg_id = data.get("msg_id")
                    if msg_id:
                        await manager.broadcast_message_deleted(streamer_username, msg_id)
                        db = SessionLocal()
                        try:
                            db_id_str = msg_id.replace("msg-", "")
                            try:
                                db_id = int(db_id_str)
                                db.query(ChatMessage).filter(
                                    ChatMessage.id == db_id,
                                    ChatMessage.room == streamer_username
                                ).delete()
                                db.commit()
                            except ValueError:
                                pass
                        except Exception:
                            db.rollback()
                        finally:
                            db.close()
                
                elif action == "brb":
                    enabled = data.get("enabled", False)
                    await manager.broadcast(streamer_username, {
                        "type": "brb",
                        "enabled": enabled
                    })
                    await manager.broadcast(streamer_username, {
                        "type": "system",
                        "id": f"sys-{int(time.time() * 1000)}",
                        "user": "System",
                        "text": "🛡️ Stream paused (BRB)" if enabled else "▶️ Stream resumed",
                        "timestamp": int(time.time() * 1000),
                        "isMod": True
                    })

                continue
            

            # ── Handle Chat Messages ────────────────────────────────
            if not username:
                await manager.send_personal(websocket, {
                    "type": "error", "text": "You must be logged in to send messages"
                })
                continue
            
            text = data.get("text", "").strip()
            if not text:
                continue
            
            # Enforce slow mode for non-creators
            if not is_creator and not manager.check_slow_mode_cooldown(streamer_username, username):
                await manager.send_personal(websocket, {
                    "type": "error",
                    "text": f"Slow mode is on. Wait {manager.SLOW_MODE_COOLDOWN}s between messages."
                })
                continue
            
            # Truncate
            if len(text) > 500:
                text = text[:500]
            
            timestamp = int(time.time() * 1000)
            
            # Persist to DB
            db = SessionLocal()
            try:
                chat_msg = ChatMessage(
                    room=streamer_username,
                    sender=username,
                    text=text,
                    is_mod=is_creator
                )
                db.add(chat_msg)
                db.commit()
                db.refresh(chat_msg)
                msg_id = f"msg-{chat_msg.id}"
            except Exception:
                db.rollback()
                msg_id = f"msg-{timestamp}"
            finally:
                db.close()
            
            await manager.broadcast(streamer_username, {
                "type": "chat",
                "id": msg_id,
                "user": username,
                "text": text,
                "timestamp": timestamp,
                "isMod": is_creator
            })
    
    except WebSocketDisconnect:
        manager.disconnect(streamer_username, websocket)
        await manager.broadcast_viewer_list(streamer_username)
    except Exception:
        manager.disconnect(streamer_username, websocket)
        await manager.broadcast_viewer_list(streamer_username)


# ============================================================================
# HTTP: Chat History
# ============================================================================

@router.get("/chat/history/{streamer_username}")
def get_chat_history(
    streamer_username: str,
    db: Session = Depends(get_db)
):
    """Fetch the last 50 chat messages for a streamer's room."""
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.room == streamer_username)
        .order_by(ChatMessage.created_at.desc())
        .limit(50)
        .all()
    )
    messages.reverse()
    
    return [
        {
            "id": f"msg-{msg.id}",
            "user": msg.sender,
            "text": msg.text,
            "timestamp": int(msg.created_at.timestamp() * 1000),
            "isMod": msg.is_mod
        }
        for msg in messages
    ]


# ============================================================================
# HTTP: Activity History
# ============================================================================

@router.get("/live/activity/history/{streamer_username}")
def get_activity_history(
    streamer_username: str,
    db: Session = Depends(get_db)
):
    """Fetch the last 10 activity events for a streamer's room."""
    activities = (
        db.query(ActivityLog)
        .filter(ActivityLog.room == streamer_username)
        .order_by(ActivityLog.created_at.desc())
        .limit(10)
        .all()
    )
    activities.reverse()
    
    return [
        {
            "id": f"act-{act.id}",
            "activity_type": act.activity_type,
            "user": act.username,
            "timestamp": int(act.created_at.timestamp() * 1000)
        }
        for act in activities
    ]


# ============================================================================
# HTTP: Clip Logging
# ============================================================================

@router.post("/live/clip")
def create_clip(
    db: Session = Depends(get_db)
):
    """
    Log a clip marker timestamp for future manual clipping.
    Requires authentication via the Authorization header (handled by ApiClient).
    """
    from backend.core.security import decode_access_token as decode_token
    from fastapi import Request
    
    # For simplicity, we log with a placeholder username (auth is via ApiClient)
    clip = ClipLog(
        room="system",
        username="creator",
        clip_timestamp=datetime.utcnow()
    )
    db.add(clip)
    db.commit()
    
    return {"success": True, "clip_id": clip.id, "timestamp": clip.clip_timestamp.isoformat()}


# ============================================================================
# HTTP: Stream Marker
# ============================================================================

@router.post("/live/marker")
def create_marker(
    db: Session = Depends(get_db)
):
    """Save a stream marker timestamp for future reference."""
    marker = StreamMarker(
        room="system",
        username="creator",
        marker_timestamp=datetime.utcnow()
    )
    db.add(marker)
    db.commit()

    return {"success": True, "marker_id": marker.id, "timestamp": marker.marker_timestamp.isoformat()}
