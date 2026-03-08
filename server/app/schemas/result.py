"""Schemas for participant result persistence."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ResultSaveRequest(BaseModel):
    participant_id: str = Field(default="", max_length=128)
    file_name: str | None = Field(default=None, max_length=256)
    schema_version: str | None = Field(default=None, max_length=32)
    saved_at: str | None = Field(default=None, max_length=64)
    payload: dict[str, Any] = Field(default_factory=dict)


class ResultSaveResponse(BaseModel):
    ok: bool
    saved_path: str
    participant_id: str
    bytes_written: int
