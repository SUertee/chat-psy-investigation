"""Application configuration loaded from environment variables."""

from __future__ import annotations

from dataclasses import dataclass
import os


def _parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_csv(value: str | None, default: tuple[str, ...]) -> tuple[str, ...]:
    if value is None:
        return default
    items = tuple(item.strip() for item in value.split(",") if item.strip())
    return items or default


@dataclass(frozen=True)
class Settings:
    app_name: str
    environment: str
    debug: bool
    api_prefix: str
    cors_origins: tuple[str, ...]


def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "chat-psy-backend"),
        environment=os.getenv("APP_ENV", "development"),
        debug=_parse_bool(os.getenv("APP_DEBUG"), default=True),
        api_prefix=os.getenv("API_PREFIX", "/api"),
        cors_origins=_parse_csv(os.getenv("CORS_ORIGINS"), default=("*",)),
    )
