from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field, field_validator


class LoginRequest(BaseModel):
    login: str = Field(min_length=2, max_length=128)
    password: str = Field(min_length=3, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str | None = Field(default=None, min_length=3, max_length=128)
    new_password: str = Field(min_length=3, max_length=128)


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
    game_date: date | None = None
    master_employee_id: int = Field(gt=0)
    participant_ids: list[int] = Field(default_factory=list)
    loot_object_id: int | None = Field(default=None, gt=0)
    loot_quantity: int = Field(default=1, ge=1)
    description: str | None = Field(default=None, max_length=2000)


class AccountCreateRequest(BaseModel):
    employee_id: int = Field(gt=0)
    role_id: int = Field(gt=0)
    password: str = Field(default="pas123", min_length=3, max_length=128)


class AccountUpdateRequest(BaseModel):
    role_id: int | None = Field(default=None, gt=0)
    is_blocked: bool | None = None


class RoleCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=64)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()


class RoleUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=64)
    is_blocked: bool | None = None

    @field_validator("name")
    @classmethod
    def normalize_optional_name(cls, value: str | None) -> str | None:
        return value.strip() if value else value


class RolePermissionUpdateRequest(BaseModel):
    tab_id: int = Field(gt=0)
    access: str = Field(pattern="^(HIDDEN|READ|WRITE)$")


class UiTabCreateRequest(BaseModel):
    title: str = Field(min_length=2, max_length=128)
    route: str = Field(min_length=2, max_length=255)
    db_view_name: str | None = Field(default=None, max_length=128)
    description: str | None = Field(default=None, max_length=1000)
    sort_order: int = 0
    is_enabled: bool = True


class UiTabUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=128)
    route: str | None = Field(default=None, min_length=2, max_length=255)
    db_view_name: str | None = Field(default=None, max_length=128)
    description: str | None = Field(default=None, max_length=1000)
    sort_order: int | None = None
    is_enabled: bool | None = None


class EmployeeCreateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    position: str | None = Field(default=None, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    photo: str | None = Field(default=None, max_length=512)


class ParticipantCreateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    photo: str | None = Field(default=None, max_length=512)
    age: int | None = Field(default=None, ge=1, le=99)
    school: str | None = Field(default=None, max_length=128)
    class_name: str | None = Field(default=None, max_length=32)
    note: str | None = Field(default=None, max_length=4000)


class RelativeCreateRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    photo: str | None = Field(default=None, max_length=512)
    note: str | None = Field(default=None, max_length=4000)


class PeopleBulkDeleteRequest(BaseModel):
    entity: str = Field(pattern="^(employees|participants|relatives)$")
    ids: list[int] = Field(default_factory=list)


class RelationCreateRequest(BaseModel):
    participant_id: int = Field(gt=0)
    relative_id: int = Field(gt=0)
    relation_type: str = Field(min_length=2, max_length=64)

    @field_validator("relation_type")
    @classmethod
    def normalize_relation(cls, value: str) -> str:
        return value.strip()


class GameObjectCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    object_type: str = Field(pattern="^(LOOT|ACHIEVEMENT|GEAR)$")
    price: int = Field(ge=0)
    parameters: str | None = Field(default=None, max_length=4000)


class GameObjectUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    object_type: str | None = Field(default=None, pattern="^(LOOT|ACHIEVEMENT|GEAR)$")
    price: int | None = Field(default=None, ge=0)
    parameters: str | None = Field(default=None, max_length=4000)


class GameProfileCreateRequest(BaseModel):
    participant_id: int = Field(gt=0)
    hero_name: str = Field(min_length=2, max_length=255)
    level: int = Field(default=1, ge=1)


class GameProfileQuickRequest(BaseModel):
    object_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1)

