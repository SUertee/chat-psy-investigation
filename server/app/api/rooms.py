"""Room endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..schemas.room import (
    RoomAdvanceRequest,
    RoomAdvanceResponse,
    RoomEndRoundRequest,
    RoomEndRoundResponse,
    RoomClientFeedbackRequest,
    RoomClientFeedbackResponse,
    RoomLeaveRequest,
    RoomLeaveResponse,
    RoomResponse,
)
from ..services.room_service import (
    advance_round,
    end_round,
    get_client_feedback,
    get_room,
    leave_room,
    submit_client_feedback,
)


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


@router.post("/rooms/{room_id}/client-feedback", response_model=RoomClientFeedbackResponse)
def submit_client_feedback_endpoint(room_id: str, payload: RoomClientFeedbackRequest) -> dict:
    try:
        return submit_client_feedback(
            room_id=room_id,
            participant_id=payload.participant_id,
            round_no=payload.round_no,
            relationship_feedback=payload.relationship_feedback,
            risk_exploration_feedback=payload.risk_exploration_feedback,
            protective_factor_feedback=payload.protective_factor_feedback,
            overall_suggestion=payload.overall_suggestion,
            empathy_score=payload.empathy_score,
            continue_intent=payload.continue_intent,
            notes=payload.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/rooms/{room_id}/client-feedback", response_model=RoomClientFeedbackResponse)
def get_client_feedback_endpoint(
    room_id: str,
    participant_id: str = Query(min_length=1, max_length=128),
    round_no: int = Query(ge=1, le=2),
) -> dict:
    try:
        return get_client_feedback(room_id=room_id, participant_id=participant_id, round_no=round_no)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
