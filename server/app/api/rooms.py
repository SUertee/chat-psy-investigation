"""Room endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from ..schemas.room import (
    RoomAdvanceRequest,
    RoomAdvanceResponse,
    RoomSyncStartRequest,
    RoomSyncStartResponse,
    RoomEndRoundRequest,
    RoomEndRoundResponse,
    RoomClientFeedbackRequest,
    RoomClientFeedbackResponse,
    RoomReviewCompleteRequest,
    RoomReviewCompleteResponse,
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
    sync_round_start,
    mark_counselor_review_complete,
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


@router.post("/rooms/{room_id}/sync-start", response_model=RoomSyncStartResponse)
def sync_round_start_endpoint(room_id: str, payload: RoomSyncStartRequest) -> dict:
    try:
        return sync_round_start(room_id=room_id, participant_id=payload.participant_id, round_no=payload.round_no)
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
            relationship_good=payload.relationship_good,
            relationship_improve=payload.relationship_improve,
            risk_good=payload.risk_good,
            risk_improve=payload.risk_improve,
            protective_good=payload.protective_good,
            protective_improve=payload.protective_improve,
            overall_suggestion=payload.overall_suggestion,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/rooms/{room_id}/review-complete", response_model=RoomReviewCompleteResponse)
def review_complete_endpoint(room_id: str, payload: RoomReviewCompleteRequest) -> dict:
    try:
        return mark_counselor_review_complete(
            room_id=room_id,
            participant_id=payload.participant_id,
            round_no=payload.round_no,
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
