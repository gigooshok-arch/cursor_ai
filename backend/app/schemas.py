from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    login: str = Field(min_length=2, max_length=128)
    password: str = Field(min_length=3, max_length=128)


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=255)
    photo: str | None = Field(default=None, max_length=512)
    phone: str | None = Field(default=None, max_length=32)
    age: int | None = Field(default=None, ge=1, le=99)
    school: str | None = Field(default=None, max_length=128)
    class_name: str | None = Field(default=None, max_length=32)
    note: str | None = Field(default=None, max_length=4000)
    position: str | None = Field(default=None, max_length=128)

    @field_validator("full_name", "photo", "phone", "school", "class_name", "note", "position")
    @classmethod
    def normalize_empty_string(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped if stripped else None


class AddRelationRequest(BaseModel):
    relative_id: int = Field(gt=0)
    relation_type: str = Field(min_length=2, max_length=64)

    @field_validator("relation_type")
    @classmethod
    def normalize_relation_type(cls, value: str) -> str:
        return value.strip()


class GoldPreviewRequest(BaseModel):
    price: int = Field(ge=0)
    quantity: int = Field(default=1, ge=1)


class GameCreateRequest(BaseModel):
    activity_name: str = Field(min_length=2, max_length=128)
    game_date: date
    master_employee_id: int = Field(gt=0)
    participant_ids: list[int] = Field(default_factory=list)
    loot_object_id: int | None = Field(default=None, gt=0)
    loot_quantity: int = Field(default=1, ge=1)
    description: str | None = Field(default=None, max_length=2000)

