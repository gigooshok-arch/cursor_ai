from __future__ import annotations

import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class RoleCode(str, enum.Enum):
    ADMIN = "ADMIN"
    DIRECTOR = "DIRECTOR"
    VOLUNTEER = "VOLUNTEER"
    PEDAGOGUE = "PEDAGOGUE"


class GameObjectType(str, enum.Enum):
    LOOT = "LOOT"
    ACHIEVEMENT = "ACHIEVEMENT"
    GEAR = "GEAR"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.now,
        onupdate=datetime.now,
    )


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[RoleCode] = mapped_column(Enum(RoleCode), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)

    accounts: Mapped[list["Account"]] = relationship(back_populates="role")


class Employee(Base, TimestampMixin):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    position: Mapped[str | None] = mapped_column(String(128))
    phone: Mapped[str | None] = mapped_column(String(32))
    photo: Mapped[str | None] = mapped_column(String(512))

    account: Mapped["Account | None"] = relationship(back_populates="employee", uselist=False)
    master_games: Mapped[list["GameLog"]] = relationship(back_populates="master")


class Account(Base, TimestampMixin):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"), unique=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"), nullable=False)
    login: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    force_password_change: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    employee: Mapped["Employee"] = relationship(back_populates="account")
    role: Mapped["Role"] = relationship(back_populates="accounts")


class Participant(Base, TimestampMixin):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    photo: Mapped[str | None] = mapped_column(String(512))
    phone: Mapped[str | None] = mapped_column(String(32))
    age: Mapped[int | None] = mapped_column(Integer)
    school: Mapped[str | None] = mapped_column(String(128))
    class_name: Mapped[str | None] = mapped_column(String(32))
    note: Mapped[str | None] = mapped_column(Text)

    relation_links: Mapped[list["RelationLink"]] = relationship(back_populates="participant")
    game_profile: Mapped["GameProfile | None"] = relationship(back_populates="participant", uselist=False)
    game_participations: Mapped[list["GameLogParticipant"]] = relationship(back_populates="participant")
    achievements: Mapped[list["AchievementLog"]] = relationship(back_populates="participant")


class Relative(Base, TimestampMixin):
    __tablename__ = "relatives"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    photo: Mapped[str | None] = mapped_column(String(512))
    phone: Mapped[str | None] = mapped_column(String(32))
    note: Mapped[str | None] = mapped_column(Text)

    relation_links: Mapped[list["RelationLink"]] = relationship(back_populates="relative")


class RelationLink(Base):
    __tablename__ = "relation_links"
    __table_args__ = (
        UniqueConstraint("participant_id", "relative_id", "relation_type", name="uq_relation_links"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"), nullable=False)
    relative_id: Mapped[int] = mapped_column(ForeignKey("relatives.id", ondelete="CASCADE"), nullable=False)
    relation_type: Mapped[str] = mapped_column(String(64), nullable=False)

    participant: Mapped["Participant"] = relationship(back_populates="relation_links")
    relative: Mapped["Relative"] = relationship(back_populates="relation_links")


class GameObject(Base, TimestampMixin):
    __tablename__ = "game_objects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    object_type: Mapped[GameObjectType] = mapped_column(Enum(GameObjectType), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    parameters: Mapped[str | None] = mapped_column(Text)

    loot_lines: Mapped[list["GameLogLoot"]] = relationship(back_populates="game_object")


class GameProfile(Base, TimestampMixin):
    __tablename__ = "game_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"), unique=True)
    hero_name: Mapped[str] = mapped_column(String(255), nullable=False)
    level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    loot: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    achievements: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    gold: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    participant: Mapped["Participant"] = relationship(back_populates="game_profile")


class GameLog(Base, TimestampMixin):
    __tablename__ = "game_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    game_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    activity_name: Mapped[str] = mapped_column(String(128), nullable=False)
    master_employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False)
    loot_distributed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    master: Mapped["Employee"] = relationship(back_populates="master_games")
    participants: Mapped[list["GameLogParticipant"]] = relationship(back_populates="game_log")
    loot_lines: Mapped[list["GameLogLoot"]] = relationship(back_populates="game_log")


class GameLogParticipant(Base):
    __tablename__ = "game_log_participants"
    __table_args__ = (
        UniqueConstraint("game_log_id", "participant_id", name="uq_game_log_participant"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    game_log_id: Mapped[int] = mapped_column(ForeignKey("game_logs.id", ondelete="CASCADE"), nullable=False)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"), nullable=False)

    game_log: Mapped["GameLog"] = relationship(back_populates="participants")
    participant: Mapped["Participant"] = relationship(back_populates="game_participations")


class GameLogLoot(Base):
    __tablename__ = "game_log_loot"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    game_log_id: Mapped[int] = mapped_column(ForeignKey("game_logs.id", ondelete="CASCADE"), nullable=False)
    game_object_id: Mapped[int] = mapped_column(ForeignKey("game_objects.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    gold_added: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    game_log: Mapped["GameLog"] = relationship(back_populates="loot_lines")
    game_object: Mapped["GameObject"] = relationship(back_populates="loot_lines")


class AchievementLog(Base):
    __tablename__ = "achievement_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    participant_id: Mapped[int] = mapped_column(ForeignKey("participants.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    achieved_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, nullable=False)

    participant: Mapped["Participant"] = relationship(back_populates="achievements")

