"""Chat endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..schemas.chat import ChatMessageResponse, ChatSendRequest
from ..services.chat_service import get_messages, send_message


router = APIRouter(tags=["chat"])


@router.post("/chat/send", response_model=ChatMessageResponse)
def send_message_endpoint(payload: ChatSendRequest) -> dict:
    try:
        return send_message(
            room_id=payload.room_id,
            participant_id=payload.participant_id,
            round_no=payload.round_no,
            content=payload.content,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/chat/messages/{room_id}", response_model=list[ChatMessageResponse])
def get_messages_endpoint(room_id: str, after_id: int = Query(default=0, ge=0)) -> list[dict]:
    try:
        return get_messages(room_id=room_id, after_id=after_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
