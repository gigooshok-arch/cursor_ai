from collections.abc import Generator
from typing import Any

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


connect_args: dict[str, Any] = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine: Engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    class_=Session,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragmas(dbapi_connection: Any, _connection_record: Any) -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()


def enable_wal_mode() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as connection:
        connection.execute(text("PRAGMA journal_mode=WAL;"))


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

