"""Server-side AI proxy endpoints."""

from __future__ import annotations

import json
import socket
import ssl
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Request as FastAPIRequest
from fastapi.responses import JSONResponse

from ..config import get_settings


router = APIRouter(tags=["ai"])


def _target_url() -> str:
    settings = get_settings()
    if settings.ai_provider == "volcengine":
        return settings.volcengine_api_url
    return settings.openai_api_url


@router.post("/ai/chat")
async def proxy_ai_chat(request: FastAPIRequest):
    settings = get_settings()
    if not settings.ai_api_key:
        raise HTTPException(status_code=500, detail="AI_API_KEY is not configured on the server.")

    payload = await request.json()
    payload_bytes = json.dumps(payload).encode("utf-8")

    upstream_request = Request(
        _target_url(),
        data=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.ai_api_key}",
        },
        method="POST",
    )

    ssl_context = ssl.create_default_context() if settings.ai_ssl_verify else ssl._create_unverified_context()

    try:
        with urlopen(upstream_request, timeout=settings.ai_timeout_seconds, context=ssl_context) as response:
            response_body = response.read().decode("utf-8")
            return JSONResponse(
                status_code=response.status,
                content=json.loads(response_body),
            )
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8") if exc.fp else ""
        try:
            error_json = json.loads(error_body) if error_body else {"error": "upstream http error"}
        except json.JSONDecodeError:
            error_json = {"error": error_body or f"upstream http error: {exc.code}"}
        return JSONResponse(status_code=exc.code, content=error_json)
    except (TimeoutError, socket.timeout) as exc:
        raise HTTPException(status_code=504, detail="upstream request timed out") from exc
    except URLError as exc:
        raise HTTPException(status_code=502, detail=f"upstream connection error: {exc.reason}") from exc
