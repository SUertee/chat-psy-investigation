"""FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.ai import router as ai_router
from .api.chat import router as chat_router
from .api.health import router as health_router
from .api.match import router as match_router
from .api.participants import router as participants_router
from .api.results import router as results_router
from .api.rooms import router as rooms_router
from .config import get_settings


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(ai_router, prefix=settings.api_prefix)
app.include_router(participants_router, prefix=settings.api_prefix)
app.include_router(match_router, prefix=settings.api_prefix)
app.include_router(rooms_router, prefix=settings.api_prefix)
app.include_router(chat_router, prefix=settings.api_prefix)
app.include_router(results_router, prefix=settings.api_prefix)


@app.get("/", tags=["meta"])
def root() -> dict[str, str]:
    return {
        "message": "chat backend is running",
        "docs": "/docs",
        "health": f"{settings.api_prefix}/health",
    }
