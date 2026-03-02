from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB_PATH = BASE_DIR / "rassvet.sqlite3"


class Settings(BaseSettings):
    app_name: str = "ERP-Rassvet API"
    api_prefix: str = "/api"
    secret_key: str = "CHANGE_ME_RASSVET_SECRET"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 12 * 60
    database_url: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://erp-rassvet28.ru",
        "https://erp-rassvet28.ru",
    ]

    model_config = SettingsConfigDict(
        env_prefix="RASSVET_",
        env_file=".env",
        env_file_encoding="utf-8",
    )


settings = Settings()

