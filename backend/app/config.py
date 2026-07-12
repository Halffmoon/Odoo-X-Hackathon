from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict

# Query params that are valid for libpq/psycopg but that asyncpg rejects.
# We drop them and pass SSL via connect_args instead.
_ASYNCPG_INCOMPATIBLE_PARAMS = {"sslmode", "channel_binding", "gssencmode"}


def normalize_async_dsn(url: str) -> str:
    """Return a DSN usable by SQLAlchemy's asyncpg driver.

    - Forces the ``postgresql+asyncpg`` driver.
    - Strips libpq-only query params (sslmode, channel_binding, ...) that
      asyncpg does not accept. SSL is supplied via ``connect_args`` on the
      engine, so requiring SSL still holds.
    """
    parts = urlsplit(url)
    scheme = parts.scheme
    if scheme in ("postgres", "postgresql"):
        scheme = "postgresql+asyncpg"
    elif scheme.startswith("postgresql+") and "asyncpg" not in scheme:
        scheme = "postgresql+asyncpg"

    kept = [
        (k, v)
        for k, v in parse_qsl(parts.query)
        if k.lower() not in _ASYNCPG_INCOMPATIBLE_PARAMS
    ]
    return urlunsplit(
        (scheme, parts.netloc, parts.path, urlencode(kept), parts.fragment)
    )


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    DATABASE_URL: str

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    CORS_ORIGINS: str = "http://localhost:3000"

    UPLOAD_DIR: str = "uploads"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def async_database_url(self) -> str:
        return normalize_async_dsn(self.DATABASE_URL)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
