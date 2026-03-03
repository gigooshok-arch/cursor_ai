from __future__ import annotations

import math
import re
from collections.abc import Sequence

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from .models import Account


TRANSLIT_MAP: dict[str, str] = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "e",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "kh",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "sch",
    "ъ": "",
    "ы": "y",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
}


def transliterate(value: str) -> str:
    prepared = value.strip().lower()
    raw = "".join(TRANSLIT_MAP.get(char, char) for char in prepared)
    return re.sub(r"[^a-z0-9_]+", "", raw)


def split_full_name(full_name: str) -> tuple[str, str, str]:
    parts = [part for part in full_name.strip().split() if part]
    surname = parts[0] if parts else "user"
    name = parts[1] if len(parts) > 1 else ""
    patronymic = parts[2] if len(parts) > 2 else ""
    return surname, name, patronymic


def generate_login_base(full_name: str) -> str:
    surname, name, patronymic = split_full_name(full_name)
    surname_lat = transliterate(surname) or "user"
    initials = f"{transliterate(name)[:1]}{transliterate(patronymic)[:1]}".strip()
    if initials:
        return f"{surname_lat}_{initials}"
    return surname_lat


def _load_existing_logins(db: Session, prefix: str) -> Sequence[str]:
    statement: Select[tuple[str]] = select(Account.login).where(Account.login.like(f"{prefix}%"))
    return [row[0] for row in db.execute(statement).all()]


def generate_unique_login(db: Session, full_name: str) -> str:
    base = generate_login_base(full_name)
    existing = set(_load_existing_logins(db, base))
    if base not in existing:
        return base

    suffix = 2
    while f"{base}{suffix}" in existing:
        suffix += 1
    return f"{base}{suffix}"


def gold_from_price(price: int) -> int:
    return math.floor(price / 2)

