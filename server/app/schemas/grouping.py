"""Schemas for grouping endpoints."""

from pydantic import BaseModel, Field


class GroupAssignRequest(BaseModel):
    strategy: str = Field(default="cc2e1", max_length=32)


class GroupAssignResponse(BaseModel):
    group: str
    sequence_no: int
    strategy: str
    pattern: str
    assigned_at: str
