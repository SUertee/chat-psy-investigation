"""Result persistence endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas.result import ResultSaveRequest, ResultSaveResponse
from ..services.result_service import save_result_snapshot


router = APIRouter(tags=["results"])


@router.post("/results/save", response_model=ResultSaveResponse)
def save_result_endpoint(payload: ResultSaveRequest) -> dict:
    try:
        participant_id = payload.participant_id or payload.payload.get("participant_id", "")
        return save_result_snapshot(
            participant_id=participant_id,
            payload=payload.payload or {},
            file_name=payload.file_name,
        )
    except Exception as exc:  # pragma: no cover - defensive safeguard
        raise HTTPException(status_code=500, detail=f"failed to save result: {exc}") from exc
