"""Matchmaking endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas.match import MatchJoinRequest, MatchStatusResponse
from ..services.match_service import get_match_status, join_match


router = APIRouter(tags=["match"])


@router.post("/match/join", response_model=MatchStatusResponse)
def join_match_endpoint(payload: MatchJoinRequest) -> dict:
    try:
        return join_match(payload.participant_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/match/status/{participant_id}", response_model=MatchStatusResponse)
def get_match_status_endpoint(participant_id: str) -> dict:
    return get_match_status(participant_id)
