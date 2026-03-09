"""Result persistence endpoints."""

from __future__ import annotations

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ..schemas.result import ResultSaveRequest, ResultSaveResponse
from ..services.result_service import save_result_file, save_result_snapshot


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


@router.post("/results/upload", response_model=ResultSaveResponse)
async def upload_result_file_endpoint(
    file: UploadFile = File(...),
    participant_id: str = Form(default=""),
) -> dict:
    try:
        content = await file.read()
        effective_participant = participant_id or ""
        if not effective_participant and file.filename:
            # participant_P_1234.xlsx -> P_1234
            name = file.filename
            if name.startswith("participant_"):
                effective_participant = name[len("participant_"):].split(".", 1)[0]
        return save_result_file(
            participant_id=effective_participant,
            file_bytes=content,
            file_name=file.filename,
        )
    except Exception as exc:  # pragma: no cover - defensive safeguard
        raise HTTPException(status_code=500, detail=f"failed to upload result file: {exc}") from exc
