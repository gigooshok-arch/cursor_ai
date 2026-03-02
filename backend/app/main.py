from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, joinedload, selectinload

from .business import gold_from_price
from .config import settings
from .database import Base, SessionLocal, enable_wal_mode, engine, get_db
from .dependencies import get_current_account, require_roles
from .models import (
    Account,
    AchievementLog,
    Employee,
    GameLog,
    GameLogLoot,
    GameLogParticipant,
    GameObject,
    GameObjectType,
    GameProfile,
    Participant,
    RelationLink,
    Relative,
    RoleCode,
)
from .schemas import AddRelationRequest, GameCreateRequest, GoldPreviewRequest, LoginRequest, ProfileUpdateRequest
from .security import create_access_token, verify_password
from .seed import seed_database

app = FastAPI(
    title="ERP-Rassvet API",
    description="Русскоязычное API для ERP-системы НКО «Рассвет».",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WRITE_ROLES = {RoleCode.ADMIN, RoleCode.DIRECTOR, RoleCode.PEDAGOGUE}


def envelope(message: str, data: Any | None = None) -> dict[str, Any]:
    return {"сообщение": message, "данные": data}


def format_date_ru(value: date | datetime | None) -> str:
    if value is None:
        return "—"
    if isinstance(value, datetime):
        return value.strftime("%d.%m.%Y %H:%M")
    return value.strftime("%d.%m.%Y")


def account_payload(account: Account) -> dict[str, Any]:
    return {
        "id": account.id,
        "логин": account.login,
        "фио": account.employee.full_name,
        "роль": account.role.name,
        "код_роли": account.role.code.value,
        "заблокирован": account.is_blocked,
    }


def can_write_profile(account: Account) -> bool:
    return account.role.code in WRITE_ROLES


def serialize_game_log(log: GameLog) -> dict[str, Any]:
    return {
        "id": log.id,
        "дата_игры": format_date_ru(log.game_date),
        "активность": log.activity_name,
        "мастер": log.master.full_name if log.master else "—",
        "золото_распределено": log.loot_distributed,
        "лут": [
            {
                "название": loot.game_object.name if loot.game_object else "—",
                "количество": loot.quantity,
                "золото": loot.gold_added,
            }
            for loot in log.loot_lines
        ],
    }


@app.on_event("startup")
def startup_event() -> None:
    Base.metadata.create_all(bind=engine)
    enable_wal_mode()
    with SessionLocal() as db:
        seed_database(db)
        db.commit()


@app.get(f"{settings.api_prefix}/health")
def healthcheck(db: Session = Depends(get_db)) -> dict[str, Any]:
    wal_row = db.execute(text("PRAGMA journal_mode;")).mappings().first()
    return envelope(
        "Сервис работает стабильно.",
        {
            "режим_wal": wal_row["journal_mode"] if wal_row else "unknown",
            "приложение": settings.app_name,
        },
    )


@app.post(f"{settings.api_prefix}/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    account = db.scalar(
        select(Account)
        .where(Account.login == payload.login)
        .options(joinedload(Account.employee), joinedload(Account.role))
    )
    if account is None or not verify_password(payload.password, account.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль.",
        )
    if account.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт заблокирован.",
        )

    token = create_access_token(
        {
            "sub": str(account.id),
            "role": account.role.code.value,
        }
    )
    return envelope(
        "Вход выполнен успешно.",
        {
            "токен": token,
            "тип_токена": "bearer",
            "пользователь": account_payload(account),
        },
    )


@app.get(f"{settings.api_prefix}/auth/me")
def me(account: Account = Depends(get_current_account)) -> dict[str, Any]:
    return envelope("Профиль авторизованного пользователя.", account_payload(account))


@app.get(f"{settings.api_prefix}/dashboard/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    participants_count = db.scalar(select(func.count()).select_from(Participant)) or 0
    employees_count = db.scalar(select(func.count()).select_from(Employee)) or 0
    relatives_count = db.scalar(select(func.count()).select_from(Relative)) or 0
    games_count = db.scalar(select(func.count()).select_from(GameLog)) or 0
    return envelope(
        "Сводка загружена.",
        {
            "участники": participants_count,
            "сотрудники": employees_count,
            "родственники": relatives_count,
            "игры": games_count,
            "моя_роль": account.role.name,
            "доступ_на_изменение_профиля": can_write_profile(account),
        },
    )


@app.get(f"{settings.api_prefix}/profiles")
def list_profiles(
    query: str | None = Query(default=None),
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    pattern = f"%{query.strip()}%" if query and query.strip() else None

    participant_stmt = select(Participant).order_by(Participant.full_name.asc())
    employee_stmt = select(Employee).order_by(Employee.full_name.asc())
    relative_stmt = select(Relative).order_by(Relative.full_name.asc())

    if pattern:
        participant_stmt = participant_stmt.where(Participant.full_name.ilike(pattern))
        employee_stmt = employee_stmt.where(Employee.full_name.ilike(pattern))
        relative_stmt = relative_stmt.where(Relative.full_name.ilike(pattern))

    participants = db.scalars(participant_stmt).all()
    employees = db.scalars(employee_stmt).all()
    relatives = db.scalars(relative_stmt).all()

    return envelope(
        "Список профилей сформирован.",
        {
            "пользователь": account_payload(account),
            "участники": [
                {
                    "id": item.id,
                    "фио": item.full_name,
                    "телефон": item.phone,
                    "ссылка": f"/profile/participant/{item.id}",
                }
                for item in participants
            ],
            "сотрудники": [
                {
                    "id": item.id,
                    "фио": item.full_name,
                    "телефон": item.phone,
                    "ссылка": f"/profile/employee/{item.id}",
                }
                for item in employees
            ],
            "родственники": [
                {
                    "id": item.id,
                    "фио": item.full_name,
                    "телефон": item.phone,
                    "ссылка": f"/profile/relative/{item.id}",
                }
                for item in relatives
            ],
        },
    )


def _participant_profile_data(db: Session, participant_id: int, account: Account) -> dict[str, Any]:
    participant = db.scalar(
        select(Participant)
        .where(Participant.id == participant_id)
        .options(
            selectinload(Participant.relation_links).selectinload(RelationLink.relative),
            selectinload(Participant.game_profile),
        )
    )
    if participant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Участник не найден.")

    achievements = db.scalars(
        select(AchievementLog)
        .where(AchievementLog.participant_id == participant.id)
        .order_by(AchievementLog.achieved_at.desc())
        .limit(3)
    ).all()

    games = db.scalars(
        select(GameLog)
        .join(GameLogParticipant, GameLogParticipant.game_log_id == GameLog.id)
        .where(GameLogParticipant.participant_id == participant.id)
        .options(joinedload(GameLog.master), selectinload(GameLog.loot_lines).joinedload(GameLogLoot.game_object))
        .order_by(GameLog.game_date.desc())
    ).unique().all()

    linked_relative_ids = [link.relative_id for link in participant.relation_links]
    available_relatives = []
    if can_write_profile(account):
        relatives_stmt = select(Relative).order_by(Relative.full_name.asc())
        if linked_relative_ids:
            relatives_stmt = relatives_stmt.where(Relative.id.not_in(linked_relative_ids))
        available_relatives = [
            {"id": relative.id, "фио": relative.full_name}
            for relative in db.scalars(relatives_stmt).all()
        ]

    base_data: dict[str, Any] = {
        "тип": "Участник",
        "entity_type": "participant",
        "id": participant.id,
        "технический_id": participant.id,
        "фио": participant.full_name,
        "фото": participant.photo,
        "телефон": participant.phone,
        "примечание": participant.note,
        "школа": participant.school,
        "класс": participant.class_name,
        "возраст": participant.age,
        "создано": format_date_ru(participant.created_at),
        "обновлено": format_date_ru(participant.updated_at),
        "родственники": [
            {
                "id": link.relative.id,
                "фио": link.relative.full_name,
                "телефон": link.relative.phone,
                "тип_связи": link.relation_type,
                "ссылка": f"/profile/relative/{link.relative.id}",
                "relation_id": link.id,
            }
            for link in participant.relation_links
        ],
        "игровой_профиль": (
            {
                "герой": participant.game_profile.hero_name,
                "уровень": participant.game_profile.level,
                "лут": participant.game_profile.loot,
                "ачивки": participant.game_profile.achievements,
                "золото": participant.game_profile.gold,
            }
            if participant.game_profile
            else None
        ),
        "последние_ачивки": [
            {
                "id": item.id,
                "название": item.title,
                "дата": format_date_ru(item.achieved_at),
            }
            for item in achievements
        ],
        "игровая_история": [serialize_game_log(game) for game in games],
        "доступные_родственники": available_relatives,
    }

    if account.role.code == RoleCode.VOLUNTEER:
        return {
            "тип": base_data["тип"],
            "entity_type": base_data["entity_type"],
            "id": base_data["id"],
            "технический_id": base_data["технический_id"],
            "фио": base_data["фио"],
            "фото": base_data["фото"],
            "телефон": base_data["телефон"],
            "родственники": base_data["родственники"],
            "игровая_история": base_data["игровая_история"],
        }
    return base_data


def _employee_profile_data(db: Session, employee_id: int, account: Account) -> dict[str, Any]:
    employee = db.scalar(
        select(Employee)
        .where(Employee.id == employee_id)
        .options(selectinload(Employee.account).selectinload(Account.role))
    )
    if employee is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сотрудник не найден.")

    games = db.scalars(
        select(GameLog)
        .where(GameLog.master_employee_id == employee.id)
        .options(joinedload(GameLog.master), selectinload(GameLog.loot_lines).joinedload(GameLogLoot.game_object))
        .order_by(GameLog.game_date.desc())
    ).all()

    data: dict[str, Any] = {
        "тип": "Сотрудник",
        "entity_type": "employee",
        "id": employee.id,
        "технический_id": employee.id,
        "создано": format_date_ru(employee.created_at),
        "обновлено": format_date_ru(employee.updated_at),
        "фио": employee.full_name,
        "фото": employee.photo,
        "телефон": employee.phone,
        "должность": employee.position,
        "игровая_история": [serialize_game_log(game) for game in games],
    }
    if account.role.code != RoleCode.VOLUNTEER and employee.account:
        data["аккаунт"] = {
            "логин": employee.account.login,
            "роль": employee.account.role.name,
            "блокировка": employee.account.is_blocked,
        }
    return data


def _relative_profile_data(db: Session, relative_id: int, account: Account) -> dict[str, Any]:
    relative = db.scalar(
        select(Relative)
        .where(Relative.id == relative_id)
        .options(selectinload(Relative.relation_links).selectinload(RelationLink.participant))
    )
    if relative is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Родственник не найден.")

    participant_ids = [link.participant_id for link in relative.relation_links]
    games: list[GameLog] = []
    if participant_ids:
        games = db.scalars(
            select(GameLog)
            .join(GameLogParticipant, GameLogParticipant.game_log_id == GameLog.id)
            .where(GameLogParticipant.participant_id.in_(participant_ids))
            .options(joinedload(GameLog.master), selectinload(GameLog.loot_lines).joinedload(GameLogLoot.game_object))
            .order_by(GameLog.game_date.desc())
        ).unique().all()

    data: dict[str, Any] = {
        "тип": "Родственник",
        "entity_type": "relative",
        "id": relative.id,
        "технический_id": relative.id,
        "создано": format_date_ru(relative.created_at),
        "обновлено": format_date_ru(relative.updated_at),
        "фио": relative.full_name,
        "фото": relative.photo,
        "телефон": relative.phone,
        "примечание": relative.note,
        "связанные_участники": [
            {
                "id": link.participant.id,
                "фио": link.participant.full_name,
                "телефон": link.participant.phone,
                "тип_связи": link.relation_type,
                "ссылка": f"/profile/participant/{link.participant.id}",
            }
            for link in relative.relation_links
        ],
        "игровая_история": [serialize_game_log(game) for game in games],
    }
    if account.role.code == RoleCode.VOLUNTEER:
        data.pop("примечание", None)
    return data


@app.get(f"{settings.api_prefix}/profiles/{{entity_type}}/{{entity_id}}")
def profile_detail(
    entity_type: Literal["participant", "employee", "relative"],
    entity_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    if entity_id <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Некорректный ID пользователя.")

    if entity_type == "participant":
        data = _participant_profile_data(db, entity_id, account)
    elif entity_type == "employee":
        data = _employee_profile_data(db, entity_id, account)
    else:
        data = _relative_profile_data(db, entity_id, account)

    data["доступ"] = {
        "чтение": True,
        "изменение": can_write_profile(account),
    }
    return envelope("Карточка пользователя сформирована.", data)


@app.patch(f"{settings.api_prefix}/profiles/{{entity_type}}/{{entity_id}}")
def update_profile(
    entity_type: Literal["participant", "employee", "relative"],
    entity_id: int,
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    _account: Account = Depends(require_roles(RoleCode.ADMIN, RoleCode.DIRECTOR, RoleCode.PEDAGOGUE)),
) -> dict[str, Any]:
    if entity_type == "participant":
        model = db.get(Participant, entity_id)
        if model is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Участник не найден.")
        if payload.full_name is not None:
            model.full_name = payload.full_name
        if payload.photo is not None:
            model.photo = payload.photo
        if payload.phone is not None:
            model.phone = payload.phone
        if payload.age is not None:
            model.age = payload.age
        if payload.school is not None:
            model.school = payload.school
        if payload.class_name is not None:
            model.class_name = payload.class_name
        if payload.note is not None:
            model.note = payload.note
    elif entity_type == "employee":
        model = db.get(Employee, entity_id)
        if model is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Сотрудник не найден.")
        if payload.full_name is not None:
            model.full_name = payload.full_name
        if payload.photo is not None:
            model.photo = payload.photo
        if payload.phone is not None:
            model.phone = payload.phone
        if payload.position is not None:
            model.position = payload.position
    else:
        model = db.get(Relative, entity_id)
        if model is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Родственник не найден.")
        if payload.full_name is not None:
            model.full_name = payload.full_name
        if payload.photo is not None:
            model.photo = payload.photo
        if payload.phone is not None:
            model.phone = payload.phone
        if payload.note is not None:
            model.note = payload.note

    db.commit()
    return envelope("Изменения профиля успешно сохранены.", {"id": entity_id, "entity_type": entity_type})


@app.post(f"{settings.api_prefix}/profiles/participant/{{participant_id}}/relations")
def add_participant_relation(
    participant_id: int,
    payload: AddRelationRequest,
    db: Session = Depends(get_db),
    _account: Account = Depends(require_roles(RoleCode.ADMIN, RoleCode.DIRECTOR, RoleCode.PEDAGOGUE)),
) -> dict[str, Any]:
    participant = db.get(Participant, participant_id)
    relative = db.get(Relative, payload.relative_id)
    if participant is None:
        raise HTTPException(status_code=404, detail="Участник не найден.")
    if relative is None:
        raise HTTPException(status_code=404, detail="Родственник не найден.")

    existing = db.scalar(
        select(RelationLink).where(
            RelationLink.participant_id == participant.id,
            RelationLink.relative_id == relative.id,
            RelationLink.relation_type == payload.relation_type,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=400, detail="Такая связь уже существует.")

    try:
        db.add(
            RelationLink(
                participant_id=participant.id,
                relative_id=relative.id,
                relation_type=payload.relation_type,
            )
        )
        participant.updated_at = datetime.now()
        db.commit()
    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Не удалось создать связь: {error}") from error

    return envelope("Связь с родственником добавлена.", {"participant_id": participant.id, "relative_id": relative.id})


@app.delete(f"{settings.api_prefix}/profiles/participant/{{participant_id}}/relations/{{relation_id}}")
def remove_participant_relation(
    participant_id: int,
    relation_id: int,
    db: Session = Depends(get_db),
    _account: Account = Depends(require_roles(RoleCode.ADMIN, RoleCode.DIRECTOR, RoleCode.PEDAGOGUE)),
) -> dict[str, Any]:
    participant = db.get(Participant, participant_id)
    relation = db.get(RelationLink, relation_id)
    if participant is None:
        raise HTTPException(status_code=404, detail="Участник не найден.")
    if relation is None or relation.participant_id != participant.id:
        raise HTTPException(status_code=404, detail="Связь не найдена.")

    try:
        db.delete(relation)
        participant.updated_at = datetime.now()
        db.commit()
    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Не удалось удалить связь: {error}") from error

    return envelope("Связь с родственником удалена.", {"participant_id": participant.id, "relation_id": relation_id})


@app.post(f"{settings.api_prefix}/games/preview-gold")
def preview_gold(
    payload: GoldPreviewRequest,
    _account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    value = gold_from_price(payload.price) * payload.quantity
    return envelope("Предпросмотр золота рассчитан.", {"золото": value})


@app.post(f"{settings.api_prefix}/games")
def create_game_log(
    payload: GameCreateRequest,
    db: Session = Depends(get_db),
    _account: Account = Depends(require_roles(RoleCode.ADMIN, RoleCode.DIRECTOR, RoleCode.PEDAGOGUE)),
) -> dict[str, Any]:
    master = db.get(Employee, payload.master_employee_id)
    if master is None:
        raise HTTPException(status_code=404, detail="Мастер игры не найден.")

    participants = []
    if payload.participant_ids:
        participants = db.scalars(select(Participant).where(Participant.id.in_(payload.participant_ids))).all()
    if not participants:
        raise HTTPException(status_code=400, detail="Для записи игры нужны участники.")

    loot_object: GameObject | None = None
    total_gold = 0
    if payload.loot_object_id is not None:
        loot_object = db.get(GameObject, payload.loot_object_id)
        if loot_object is None:
            raise HTTPException(status_code=404, detail="Игровой объект лута не найден.")
        total_gold = gold_from_price(loot_object.price) * payload.loot_quantity

    try:
        game_log = GameLog(
            game_date=payload.game_date,
            activity_name=payload.activity_name,
            master_employee_id=master.id,
            loot_distributed=total_gold,
            description=payload.description,
        )
        db.add(game_log)
        db.flush()

        for participant in participants:
            db.add(
                GameLogParticipant(
                    game_log_id=game_log.id,
                    participant_id=participant.id,
                )
            )

        if loot_object is not None:
            db.add(
                GameLogLoot(
                    game_log_id=game_log.id,
                    game_object_id=loot_object.id,
                    quantity=payload.loot_quantity,
                    gold_added=total_gold,
                )
            )

            per_participant = total_gold // len(participants)
            for participant in participants:
                profile = db.scalar(select(GameProfile).where(GameProfile.participant_id == participant.id))
                if profile is None:
                    profile = GameProfile(
                        participant_id=participant.id,
                        hero_name=f"Герой {participant.full_name.split()[0]}",
                        level=1,
                        loot=0,
                        achievements=0,
                        gold=0,
                    )
                    db.add(profile)
                    db.flush()
                profile.gold += per_participant
                if loot_object.object_type == GameObjectType.LOOT:
                    profile.loot += payload.loot_quantity
                if loot_object.object_type == GameObjectType.ACHIEVEMENT:
                    profile.achievements += payload.loot_quantity
                    db.add(
                        AchievementLog(
                            participant_id=participant.id,
                            title=f"Награда: {loot_object.name}",
                            achieved_at=datetime.now(),
                        )
                    )

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Не удалось сохранить игру: {error}") from error

    return envelope(
        "Игровой лог успешно создан.",
        {
            "id": game_log.id,
            "дата_игры": format_date_ru(game_log.game_date),
            "золото_распределено": total_gold,
        },
    )

