"""Room endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas.room import (
    RoomAdvanceRequest,
    RoomAdvanceResponse,
    RoomEndRoundRequest,
    RoomEndRoundResponse,
    RoomLeaveRequest,
    RoomLeaveResponse,
    RoomResponse,
)
from ..services.room_service import advance_round, end_round, get_room, leave_room


router = APIRouter(tags=["rooms"])


@router.get("/rooms/{room_id}", response_model=RoomResponse)
def get_room_endpoint(room_id: str) -> dict:
    try:
        return get_room(room_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/rooms/{room_id}/advance-round", response_model=RoomAdvanceResponse)
def advance_round_endpoint(room_id: str, payload: RoomAdvanceRequest) -> dict:
    try:
        return advance_round(room_id, payload.participant_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/rooms/{room_id}/leave", response_model=RoomLeaveResponse)
def leave_room_endpoint(room_id: str, payload: RoomLeaveRequest) -> dict:
    try:
        return leave_room(room_id, payload.participant_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/rooms/{room_id}/end-round", response_model=RoomEndRoundResponse)
def end_round_endpoint(room_id: str, payload: RoomEndRoundRequest) -> dict:
    try:
        return end_round(room_id, payload.participant_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
