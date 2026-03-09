"""Grouping assignment endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..schemas.grouping import GroupAssignRequest, GroupAssignResponse
from ..services.grouping_service import assign_group


router = APIRouter(tags=["grouping"])


@router.post("/grouping/assign", response_model=GroupAssignResponse)
def assign_group_endpoint(payload: GroupAssignRequest) -> dict:
    try:
        return assign_group(strategy=payload.strategy)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
