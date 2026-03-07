"""Application configuration loaded from environment variables."""

from __future__ import annotations

from dataclasses import dataclass
import os
from pathlib import Path


def _load_dotenv() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        os.environ.setdefault(key, value)


_load_dotenv()


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
    ai_provider: str
    ai_api_key: str
    openai_api_url: str
    volcengine_api_url: str
    ai_timeout_seconds: int
    ai_ssl_verify: bool


def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "chat-psy-backend"),
        environment=os.getenv("APP_ENV", "development"),
        debug=_parse_bool(os.getenv("APP_DEBUG"), default=True),
        api_prefix=os.getenv("API_PREFIX", "/api"),
        cors_origins=_parse_csv(os.getenv("CORS_ORIGINS"), default=("*",)),
        ai_provider=os.getenv("AI_PROVIDER", "openai").strip().lower(),
        ai_api_key=os.getenv("AI_API_KEY", "").strip(),
        openai_api_url=os.getenv("OPENAI_API_URL", "https://api.chatanywhere.tech/v1/chat/completions").strip(),
        volcengine_api_url=os.getenv("VOLCENGINE_API_URL", "https://ark.cn-beijing.volces.com/api/v3/chat/completions").strip(),
        ai_timeout_seconds=int(os.getenv("AI_TIMEOUT_SECONDS", "60")),
        ai_ssl_verify=_parse_bool(os.getenv("AI_SSL_VERIFY"), default=True),
    )
