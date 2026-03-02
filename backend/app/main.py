from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Literal

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, joinedload, selectinload

from .business import generate_unique_login, gold_from_price, transliterate
from .config import settings
from .database import Base, SessionLocal, enable_wal_mode, engine, get_db
from .dependencies import get_current_account
from .models import (
    AccessLevel,
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
    Role,
    RoleTabPermission,
    SystemRoleCode,
    UiTab,
)
from .schemas import (
    AccountCreateRequest,
    AccountUpdateRequest,
    AddRelationRequest,
    ChangePasswordRequest,
    EmployeeCreateRequest,
    GameCreateRequest,
    GameObjectCreateRequest,
    GameObjectUpdateRequest,
    GameProfileCreateRequest,
    GameProfileQuickRequest,
    GoldPreviewRequest,
    LoginRequest,
    ParticipantCreateRequest,
    PeopleBulkDeleteRequest,
    ProfileUpdateRequest,
    RelationCreateRequest,
    RelativeCreateRequest,
    RoleCreateRequest,
    RolePermissionUpdateRequest,
    RoleUpdateRequest,
    UiTabCreateRequest,
    UiTabUpdateRequest,
)
from .security import create_access_token, hash_password, verify_password
from .seed import seed_database

app = FastAPI(
    title="ERP-Rassvet API",
    description="Русскоязычное API ERP-системы НКО «Рассвет».",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ACCESS_RANK = {
    AccessLevel.HIDDEN: 0,
    AccessLevel.READ: 1,
    AccessLevel.WRITE: 2,
}


def envelope(message: str, data: Any | None = None) -> dict[str, Any]:
    return {"сообщение": message, "данные": data}


def format_date_ru(value: date | datetime | None) -> str:
    if value is None:
        return "—"
    if isinstance(value, datetime):
        return value.strftime("%d.%m.%Y %H:%M")
    return value.strftime("%d.%m.%Y")


def role_display_name(code: str, fallback: str) -> str:
    mapping = {
        SystemRoleCode.ADMIN: "Админ",
        SystemRoleCode.DIRECTOR: "Директор",
        SystemRoleCode.VOLUNTEER: "Волонтер",
        SystemRoleCode.PEDAGOGUE: "Педагог",
    }
    return mapping.get(code, fallback)


def account_payload(account: Account) -> dict[str, Any]:
    return {
        "id": account.id,
        "логин": account.login,
        "фио": account.employee.full_name,
        "роль": role_display_name(account.role.code, account.role.name),
        "код_роли": account.role.code,
        "заблокирован": account.is_blocked,
        "нужна_смена_пароля": account.force_password_change,
    }


def serialize_game_log(log: GameLog) -> dict[str, Any]:
    return {
        "id": log.id,
        "дата_игры": format_date_ru(log.game_date),
        "активность": log.activity_name,
        "мастер": log.master.full_name if log.master else "—",
        "участников": len(log.participants),
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


def build_role_code(name: str) -> str:
    raw = transliterate(name)
    cleaned = re.sub(r"[^a-z0-9]+", "_", raw).strip("_")
    return (cleaned or "role").upper()


def ensure_unique_role_code(db: Session, name: str) -> str:
    base = build_role_code(name)
    code = base
    suffix = 2
    while db.scalar(select(Role).where(Role.code == code)) is not None:
        code = f"{base}_{suffix}"
        suffix += 1
    return code


def get_tab_access_level(db: Session, role_id: int, tab_key: str) -> AccessLevel:
    access = db.scalar(
        select(RoleTabPermission.access)
        .join(UiTab, UiTab.id == RoleTabPermission.tab_id)
        .where(RoleTabPermission.role_id == role_id, UiTab.key == tab_key, UiTab.is_enabled.is_(True))
    )
    return access or AccessLevel.HIDDEN


def ensure_tab_access(
    db: Session,
    account: Account,
    tab_key: str,
    required: AccessLevel,
) -> AccessLevel:
    access = get_tab_access_level(db, account.role_id, tab_key)
    if ACCESS_RANK[access] < ACCESS_RANK[required]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для этой вкладки.",
        )
    return access


def assert_admin_code(account: Account) -> None:
    if account.role.code != SystemRoleCode.ADMIN:
        raise HTTPException(status_code=403, detail="Операция доступна только администратору.")


def require_people_write(db: Session, account: Account) -> None:
    ensure_tab_access(db, account, "people", AccessLevel.WRITE)


def require_admin_write(db: Session, account: Account) -> None:
    ensure_tab_access(db, account, "admin", AccessLevel.WRITE)


def require_admin_read(db: Session, account: Account) -> AccessLevel:
    return ensure_tab_access(db, account, "admin", AccessLevel.READ)


def require_game_profiles_write(db: Session, account: Account) -> None:
    ensure_tab_access(db, account, "game_profiles", AccessLevel.WRITE)


def require_games_write(db: Session, account: Account) -> None:
    ensure_tab_access(db, account, "games", AccessLevel.WRITE)


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
        raise HTTPException(status_code=401, detail="Неверный логин или пароль.")
    if account.is_blocked:
        raise HTTPException(status_code=403, detail="Логин пользователя заблокирован.")
    if account.role.is_blocked:
        raise HTTPException(status_code=403, detail="Роль пользователя заблокирована.")

    token = create_access_token({"sub": str(account.id), "role": account.role.code})
    return envelope(
        "Авторизация выполнена успешно.",
        {
            "токен": token,
            "тип_токена": "bearer",
            "пользователь": account_payload(account),
        },
    )


@app.get(f"{settings.api_prefix}/auth/me")
def me(account: Account = Depends(get_current_account)) -> dict[str, Any]:
    return envelope("Профиль текущего пользователя загружен.", account_payload(account))


@app.post(f"{settings.api_prefix}/auth/change-password")
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    if not payload.current_password:
        raise HTTPException(status_code=400, detail="Введите текущий пароль.")
    if not verify_password(payload.current_password, account.password_hash):
        raise HTTPException(status_code=400, detail="Текущий пароль указан неверно.")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="Новый пароль должен отличаться от текущего.")

    account.password_hash = hash_password(payload.new_password)
    account.force_password_change = False
    db.commit()
    return envelope("Пароль успешно изменен.")


@app.get(f"{settings.api_prefix}/ui/navigation")
def ui_navigation(
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    tabs = db.scalars(select(UiTab).where(UiTab.is_enabled.is_(True)).order_by(UiTab.sort_order.asc())).all()

    items: list[dict[str, Any]] = []
    for tab in tabs:
        access = db.scalar(
            select(RoleTabPermission.access).where(
                RoleTabPermission.role_id == account.role_id,
                RoleTabPermission.tab_id == tab.id,
            )
        ) or AccessLevel.HIDDEN
        if access == AccessLevel.HIDDEN:
            continue
        items.append(
            {
                "id": tab.id,
                "key": tab.key,
                "название": tab.title,
                "route": tab.route,
                "access": access.value,
                "read": ACCESS_RANK[access] >= ACCESS_RANK[AccessLevel.READ],
                "write": ACCESS_RANK[access] >= ACCESS_RANK[AccessLevel.WRITE],
            }
        )

    return envelope(
        "Список вкладок сформирован.",
        {
            "приветствие": f"Привет, {account.employee.full_name}. Ваша роль: {role_display_name(account.role.code, account.role.name)}",
            "вкладки": items,
        },
    )


@app.get(f"{settings.api_prefix}/dashboard/summary")
def dashboard_summary(
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    return envelope(
        "Сводные карточки загружены.",
        {
            "участники": db.scalar(select(func.count()).select_from(Participant)) or 0,
            "сотрудники": db.scalar(select(func.count()).select_from(Employee)) or 0,
            "родители": db.scalar(select(func.count()).select_from(Relative)) or 0,
            "игровые_профиля": db.scalar(select(func.count()).select_from(GameProfile)) or 0,
            "игры": db.scalar(select(func.count()).select_from(GameLog)) or 0,
            "моя_роль": role_display_name(account.role.code, account.role.name),
        },
    )


@app.get(f"{settings.api_prefix}/admin/bootstrap")
def admin_bootstrap(
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    access = require_admin_read(db, account)

    accounts = db.scalars(
        select(Account)
        .options(joinedload(Account.employee), joinedload(Account.role))
        .order_by(Account.id.asc())
    ).all()
    roles = db.scalars(select(Role).order_by(Role.id.asc())).all()
    tabs = db.scalars(select(UiTab).order_by(UiTab.sort_order.asc(), UiTab.id.asc())).all()
    permissions = db.scalars(select(RoleTabPermission)).all()
    employees = db.scalars(select(Employee).order_by(Employee.full_name.asc())).all()
    employees_without_account = db.scalars(
        select(Employee)
        .outerjoin(Account, Account.employee_id == Employee.id)
        .where(Account.id.is_(None))
        .order_by(Employee.full_name.asc())
    ).all()

    sqlite_views = []
    if settings.database_url.startswith("sqlite"):
        sqlite_views = [row[0] for row in db.execute(text("SELECT name FROM sqlite_master WHERE type='view' ORDER BY name")).all()]

    return envelope(
        "Данные администрирования загружены.",
        {
            "доступ": access.value,
            "can_write": access == AccessLevel.WRITE,
            "аккаунты": [
                {
                    "id": item.id,
                    "логин": item.login,
                    "сотрудник_id": item.employee_id,
                    "сотрудник_фио": item.employee.full_name,
                    "роль_id": item.role_id,
                    "роль": role_display_name(item.role.code, item.role.name),
                    "роль_код": item.role.code,
                    "заблокирован": item.is_blocked,
                    "нужна_смена_пароля": item.force_password_change,
                }
                for item in accounts
            ],
            "роли": [
                {
                    "id": role.id,
                    "код": role.code,
                    "название": role_display_name(role.code, role.name),
                    "заблокирована": role.is_blocked,
                    "системная": role.code in {
                        SystemRoleCode.ADMIN,
                        SystemRoleCode.DIRECTOR,
                        SystemRoleCode.VOLUNTEER,
                        SystemRoleCode.PEDAGOGUE,
                    },
                }
                for role in roles
            ],
            "вкладки": [
                {
                    "id": tab.id,
                    "key": tab.key,
                    "название": tab.title,
                    "route": tab.route,
                    "description": tab.description,
                    "db_view_name": tab.db_view_name,
                    "включена": tab.is_enabled,
                    "порядок": tab.sort_order,
                }
                for tab in tabs
            ],
            "матрица_прав": [
                {
                    "role_id": perm.role_id,
                    "tab_id": perm.tab_id,
                    "access": perm.access.value,
                }
                for perm in permissions
            ],
            "сотрудники_без_аккаунта": [
                {"id": emp.id, "фио": emp.full_name}
                for emp in employees_without_account
            ],
            "сотрудники": [
                {"id": emp.id, "фио": emp.full_name}
                for emp in employees
            ],
            "представления_бд": sqlite_views,
        },
    )


@app.post(f"{settings.api_prefix}/admin/accounts")
def admin_create_account(
    payload: AccountCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_admin_write(db, account)

    employee = db.get(Employee, payload.employee_id)
    role = db.get(Role, payload.role_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден.")
    if role is None:
        raise HTTPException(status_code=404, detail="Роль не найдена.")
    if db.scalar(select(Account).where(Account.employee_id == employee.id)) is not None:
        raise HTTPException(status_code=400, detail="Для сотрудника уже создан аккаунт.")

    new_account = Account(
        employee_id=employee.id,
        role_id=role.id,
        login=generate_unique_login(db, employee.full_name),
        password_hash=hash_password(payload.password),
        is_blocked=False,
        force_password_change=True,
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return envelope(
        "Аккаунт успешно создан.",
        {
            "id": new_account.id,
            "логин": new_account.login,
            "временный_пароль": payload.password,
            "нужна_смена_пароля": True,
        },
    )


@app.patch(f"{settings.api_prefix}/admin/accounts/{{account_id}}")
def admin_update_account(
    account_id: int,
    payload: AccountUpdateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_admin_write(db, account)

    target = db.get(Account, account_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Аккаунт не найден.")

    if payload.role_id is not None:
        role = db.get(Role, payload.role_id)
        if role is None:
            raise HTTPException(status_code=404, detail="Роль не найдена.")
        target.role_id = role.id
    if payload.is_blocked is not None:
        target.is_blocked = payload.is_blocked

    db.commit()
    return envelope("Аккаунт обновлен.")


@app.delete(f"{settings.api_prefix}/admin/accounts/{{account_id}}")
def admin_delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_admin_write(db, account)
    target = db.get(Account, account_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Аккаунт не найден.")
    db.delete(target)
    db.commit()
    return envelope("Аккаунт удален.")


@app.post(f"{settings.api_prefix}/admin/accounts/{{account_id}}/reset-password")
def admin_reset_password(
    account_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_admin_write(db, account)
    target = db.get(Account, account_id)
    if target is None:
        raise HTTPException(status_code=404, detail="Аккаунт не найден.")

    target.password_hash = hash_password("pas123")
    target.force_password_change = True
    db.commit()
    return envelope("Пароль сброшен на стандартный.", {"временный_пароль": "pas123"})


@app.post(f"{settings.api_prefix}/admin/roles")
def admin_create_role(
    payload: RoleCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_admin_write(db, account)
    code = ensure_unique_role_code(db, payload.name)
    role = Role(code=code, name=payload.name, is_blocked=False)
    db.add(role)
    db.flush()

    tabs = db.scalars(select(UiTab)).all()
    for tab in tabs:
        db.add(RoleTabPermission(role_id=role.id, tab_id=tab.id, access=AccessLevel.HIDDEN))
    db.commit()
    return envelope("Роль создана.", {"id": role.id, "код": role.code, "название": role.name})


@app.patch(f"{settings.api_prefix}/admin/roles/{{role_id}}")
def admin_update_role(
    role_id: int,
    payload: RoleUpdateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_admin_write(db, account)
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Роль не найдена.")

    if payload.name is not None:
        role.name = payload.name
    if payload.is_blocked is not None:
        role.is_blocked = payload.is_blocked
    db.commit()
    return envelope("Роль обновлена.")


@app.delete(f"{settings.api_prefix}/admin/roles/{{role_id}}")
def admin_delete_role(
    role_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_admin_write(db, account)
    role = db.get(Role, role_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Роль не найдена.")
    if role.code in {
        SystemRoleCode.ADMIN,
        SystemRoleCode.DIRECTOR,
        SystemRoleCode.VOLUNTEER,
        SystemRoleCode.PEDAGOGUE,
    }:
        raise HTTPException(status_code=400, detail="Системную роль удалить нельзя.")
    has_accounts = db.scalar(select(func.count()).select_from(Account).where(Account.role_id == role.id)) or 0
    if has_accounts > 0:
        raise HTTPException(status_code=400, detail="Нельзя удалить роль, к которой привязаны аккаунты.")
    db.delete(role)
    db.commit()
    return envelope("Роль удалена.")


@app.post(f"{settings.api_prefix}/admin/roles/{{role_id}}/permissions")
def admin_set_role_permission(
    role_id: int,
    payload: RolePermissionUpdateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_admin_write(db, account)
    role = db.get(Role, role_id)
    tab = db.get(UiTab, payload.tab_id)
    if role is None:
        raise HTTPException(status_code=404, detail="Роль не найдена.")
    if tab is None:
        raise HTTPException(status_code=404, detail="Вкладка не найдена.")

    access = AccessLevel(payload.access)
    permission = db.scalar(
        select(RoleTabPermission).where(
            RoleTabPermission.role_id == role.id,
            RoleTabPermission.tab_id == tab.id,
        )
    )
    if permission is None:
        permission = RoleTabPermission(role_id=role.id, tab_id=tab.id, access=access)
        db.add(permission)
    else:
        permission.access = access
    db.commit()
    return envelope("Права роли обновлены.")


@app.post(f"{settings.api_prefix}/admin/tabs")
def admin_create_tab(
    payload: UiTabCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_admin_write(db, account)

    key_base = re.sub(r"[^a-z0-9]+", "_", transliterate(payload.title)).strip("_") or "tab"
    key = key_base
    suffix = 2
    while db.scalar(select(UiTab).where(UiTab.key == key)) is not None:
        key = f"{key_base}_{suffix}"
        suffix += 1

    tab = UiTab(
        key=key,
        title=payload.title,
        route=payload.route,
        description=payload.description,
        db_view_name=payload.db_view_name,
        is_enabled=payload.is_enabled,
        sort_order=payload.sort_order,
    )
    db.add(tab)
    db.flush()

    roles = db.scalars(select(Role)).all()
    for role in roles:
        db.add(RoleTabPermission(role_id=role.id, tab_id=tab.id, access=AccessLevel.HIDDEN))

    db.commit()
    return envelope("Вкладка создана.", {"id": tab.id, "key": tab.key})


@app.patch(f"{settings.api_prefix}/admin/tabs/{{tab_id}}")
def admin_update_tab(
    tab_id: int,
    payload: UiTabUpdateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_admin_write(db, account)
    tab = db.get(UiTab, tab_id)
    if tab is None:
        raise HTTPException(status_code=404, detail="Вкладка не найдена.")

    if payload.title is not None:
        tab.title = payload.title
    if payload.route is not None:
        tab.route = payload.route
    if payload.db_view_name is not None:
        tab.db_view_name = payload.db_view_name
    if payload.description is not None:
        tab.description = payload.description
    if payload.sort_order is not None:
        tab.sort_order = payload.sort_order
    if payload.is_enabled is not None:
        tab.is_enabled = payload.is_enabled
    db.commit()
    return envelope("Вкладка обновлена.")


@app.delete(f"{settings.api_prefix}/admin/tabs/{{tab_id}}")
def admin_delete_tab(
    tab_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_admin_write(db, account)
    tab = db.get(UiTab, tab_id)
    if tab is None:
        raise HTTPException(status_code=404, detail="Вкладка не найдена.")
    db.delete(tab)
    db.commit()
    return envelope("Вкладка удалена.")


@app.get(f"{settings.api_prefix}/people/bootstrap")
def people_bootstrap(
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    access = ensure_tab_access(db, account, "people", AccessLevel.READ)
    employees = db.scalars(
        select(Employee).options(selectinload(Employee.account).joinedload(Account.role)).order_by(Employee.full_name.asc())
    ).all()
    participants = db.scalars(
        select(Participant).options(selectinload(Participant.game_profile)).order_by(Participant.full_name.asc())
    ).all()
    relatives = db.scalars(
        select(Relative).options(selectinload(Relative.relation_links)).order_by(Relative.full_name.asc())
    ).all()
    relations = db.scalars(
        select(RelationLink)
        .options(joinedload(RelationLink.participant), joinedload(RelationLink.relative))
        .order_by(RelationLink.id.desc())
        .limit(300)
    ).all()

    return envelope(
        "Данные вкладки «Люди» загружены.",
        {
            "доступ": access.value,
            "can_write": access == AccessLevel.WRITE,
            "сотрудники": [
                {
                    "id": item.id,
                    "фио": item.full_name,
                    "должность": item.position,
                    "телефон": item.phone,
                    "фото": item.photo,
                    "аккаунт": item.account.login if item.account else None,
                    "роль": role_display_name(item.account.role.code, item.account.role.name) if item.account else None,
                }
                for item in employees
            ],
            "подростки": [
                {
                    "id": item.id,
                    "фио": item.full_name,
                    "телефон": item.phone,
                    "фото": item.photo,
                    "возраст": item.age,
                    "школа": item.school,
                    "класс": item.class_name,
                    "примечание": item.note,
                    "золото": item.game_profile.gold if item.game_profile else 0,
                    "игровой_профиль_id": item.game_profile.id if item.game_profile else None,
                }
                for item in participants
            ],
            "родители": [
                {
                    "id": item.id,
                    "фио": item.full_name,
                    "телефон": item.phone,
                    "фото": item.photo,
                    "примечание": item.note,
                    "связей": len(item.relation_links),
                }
                for item in relatives
            ],
            "связи": [
                {
                    "id": rel.id,
                    "participant_id": rel.participant_id,
                    "participant_name": rel.participant.full_name,
                    "relative_id": rel.relative_id,
                    "relative_name": rel.relative.full_name,
                    "relation_type": rel.relation_type,
                }
                for rel in relations
            ],
        },
    )


@app.post(f"{settings.api_prefix}/people/employees")
def people_create_employee(
    payload: EmployeeCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    employee = Employee(
        full_name=payload.full_name,
        position=payload.position,
        phone=payload.phone,
        photo=payload.photo,
    )
    db.add(employee)
    db.commit()
    return envelope("Сотрудник добавлен.")


@app.patch(f"{settings.api_prefix}/people/employees/{{employee_id}}")
def people_update_employee(
    employee_id: int,
    payload: EmployeeCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден.")
    employee.full_name = payload.full_name
    employee.position = payload.position
    employee.phone = payload.phone
    employee.photo = payload.photo
    db.commit()
    return envelope("Сотрудник обновлен.")


@app.delete(f"{settings.api_prefix}/people/employees/{{employee_id}}")
def people_delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден.")
    db.delete(employee)
    db.commit()
    return envelope("Сотрудник удален.")


@app.post(f"{settings.api_prefix}/people/participants")
def people_create_participant(
    payload: ParticipantCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    participant = Participant(
        full_name=payload.full_name,
        phone=payload.phone,
        photo=payload.photo,
        age=payload.age,
        school=payload.school,
        class_name=payload.class_name,
        note=payload.note,
    )
    db.add(participant)
    db.commit()
    return envelope("Подросток добавлен.")


@app.patch(f"{settings.api_prefix}/people/participants/{{participant_id}}")
def people_update_participant(
    participant_id: int,
    payload: ParticipantCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    participant = db.get(Participant, participant_id)
    if participant is None:
        raise HTTPException(status_code=404, detail="Подросток не найден.")
    participant.full_name = payload.full_name
    participant.phone = payload.phone
    participant.photo = payload.photo
    participant.age = payload.age
    participant.school = payload.school
    participant.class_name = payload.class_name
    participant.note = payload.note
    db.commit()
    return envelope("Подросток обновлен.")


@app.delete(f"{settings.api_prefix}/people/participants/{{participant_id}}")
def people_delete_participant(
    participant_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    participant = db.get(Participant, participant_id)
    if participant is None:
        raise HTTPException(status_code=404, detail="Подросток не найден.")
    db.delete(participant)
    db.commit()
    return envelope("Подросток удален.")


@app.post(f"{settings.api_prefix}/people/relatives")
def people_create_relative(
    payload: RelativeCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    relative = Relative(
        full_name=payload.full_name,
        phone=payload.phone,
        photo=payload.photo,
        note=payload.note,
    )
    db.add(relative)
    db.commit()
    return envelope("Родитель добавлен.")


@app.patch(f"{settings.api_prefix}/people/relatives/{{relative_id}}")
def people_update_relative(
    relative_id: int,
    payload: RelativeCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    relative = db.get(Relative, relative_id)
    if relative is None:
        raise HTTPException(status_code=404, detail="Родитель не найден.")
    relative.full_name = payload.full_name
    relative.phone = payload.phone
    relative.photo = payload.photo
    relative.note = payload.note
    db.commit()
    return envelope("Родитель обновлен.")


@app.delete(f"{settings.api_prefix}/people/relatives/{{relative_id}}")
def people_delete_relative(
    relative_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    relative = db.get(Relative, relative_id)
    if relative is None:
        raise HTTPException(status_code=404, detail="Родитель не найден.")
    db.delete(relative)
    db.commit()
    return envelope("Родитель удален.")


@app.post(f"{settings.api_prefix}/people/relations")
def people_create_relation(
    payload: RelationCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    participant = db.get(Participant, payload.participant_id)
    relative = db.get(Relative, payload.relative_id)
    if participant is None:
        raise HTTPException(status_code=404, detail="Подросток не найден.")
    if relative is None:
        raise HTTPException(status_code=404, detail="Родитель не найден.")

    exists = db.scalar(
        select(RelationLink).where(
            RelationLink.participant_id == participant.id,
            RelationLink.relative_id == relative.id,
            RelationLink.relation_type == payload.relation_type,
        )
    )
    if exists is not None:
        raise HTTPException(status_code=400, detail="Такая связь уже есть.")

    db.add(
        RelationLink(
            participant_id=participant.id,
            relative_id=relative.id,
            relation_type=payload.relation_type,
        )
    )
    db.commit()
    return envelope("Связь добавлена.")


@app.delete(f"{settings.api_prefix}/people/relations/{{relation_id}}")
def people_delete_relation(
    relation_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    relation = db.get(RelationLink, relation_id)
    if relation is None:
        raise HTTPException(status_code=404, detail="Связь не найдена.")
    db.delete(relation)
    db.commit()
    return envelope("Связь удалена.")


@app.post(f"{settings.api_prefix}/people/bulk-delete")
def people_bulk_delete(
    payload: PeopleBulkDeleteRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    ids = [item for item in payload.ids if item > 0]
    if not ids:
        return envelope("Нет элементов для удаления.")

    try:
        if payload.entity == "employees":
            entities = db.scalars(select(Employee).where(Employee.id.in_(ids))).all()
        elif payload.entity == "participants":
            entities = db.scalars(select(Participant).where(Participant.id.in_(ids))).all()
        else:
            entities = db.scalars(select(Relative).where(Relative.id.in_(ids))).all()
        for entity in entities:
            db.delete(entity)
        db.commit()
    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Не удалось выполнить массовое удаление: {error}") from error

    return envelope("Массовое удаление выполнено.")


@app.get(f"{settings.api_prefix}/profiles")
def profiles_list(
    query: str | None = Query(default=None),
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    ensure_tab_access(db, account, "people", AccessLevel.READ)
    pattern = f"%{query.strip()}%" if query and query.strip() else None
    participants_stmt = select(Participant).order_by(Participant.full_name.asc())
    employees_stmt = select(Employee).order_by(Employee.full_name.asc())
    relatives_stmt = select(Relative).order_by(Relative.full_name.asc())
    if pattern:
        participants_stmt = participants_stmt.where(Participant.full_name.ilike(pattern))
        employees_stmt = employees_stmt.where(Employee.full_name.ilike(pattern))
        relatives_stmt = relatives_stmt.where(Relative.full_name.ilike(pattern))

    participants = db.scalars(participants_stmt).all()
    employees = db.scalars(employees_stmt).all()
    relatives = db.scalars(relatives_stmt).all()
    return envelope(
        "Список карточек сформирован.",
        {
            "участники": [
                {"id": p.id, "фио": p.full_name, "телефон": p.phone, "ссылка": f"/profile/participant/{p.id}"}
                for p in participants
            ],
            "сотрудники": [
                {"id": e.id, "фио": e.full_name, "телефон": e.phone, "ссылка": f"/profile/employee/{e.id}"}
                for e in employees
            ],
            "родственники": [
                {"id": r.id, "фио": r.full_name, "телефон": r.phone, "ссылка": f"/profile/relative/{r.id}"}
                for r in relatives
            ],
        },
    )


def build_participant_profile(db: Session, participant_id: int, account: Account) -> dict[str, Any]:
    participant = db.scalar(
        select(Participant)
        .where(Participant.id == participant_id)
        .options(
            selectinload(Participant.relation_links).selectinload(RelationLink.relative),
            selectinload(Participant.game_profile),
        )
    )
    if participant is None:
        raise HTTPException(status_code=404, detail="Подросток не найден.")

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

    can_write = get_tab_access_level(db, account.role_id, "people") == AccessLevel.WRITE
    linked_relative_ids = [link.relative_id for link in participant.relation_links]
    available_relatives = []
    if can_write:
        stmt = select(Relative).order_by(Relative.full_name.asc())
        if linked_relative_ids:
            stmt = stmt.where(Relative.id.not_in(linked_relative_ids))
        available_relatives = [{"id": rel.id, "фио": rel.full_name} for rel in db.scalars(stmt).all()]

    base = {
        "тип": "Подросток",
        "entity_type": "participant",
        "id": participant.id,
        "технический_id": participant.id,
        "фио": participant.full_name,
        "фото": participant.photo,
        "телефон": participant.phone,
        "возраст": participant.age,
        "школа": participant.school,
        "класс": participant.class_name,
        "примечание": participant.note,
        "создано": format_date_ru(participant.created_at),
        "обновлено": format_date_ru(participant.updated_at),
        "родственники": [
            {
                "id": link.relative.id,
                "фио": link.relative.full_name,
                "телефон": link.relative.phone,
                "тип_связи": link.relation_type,
                "relation_id": link.id,
                "ссылка": f"/profile/relative/{link.relative.id}",
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
            {"id": row.id, "название": row.title, "дата": format_date_ru(row.achieved_at)}
            for row in achievements
        ],
        "игровая_история": [serialize_game_log(item) for item in games],
        "доступные_родственники": available_relatives,
    }
    if account.role.code == SystemRoleCode.VOLUNTEER:
        return {
            "тип": base["тип"],
            "entity_type": base["entity_type"],
            "id": base["id"],
            "технический_id": base["технический_id"],
            "фио": base["фио"],
            "фото": base["фото"],
            "телефон": base["телефон"],
            "родственники": base["родственники"],
            "игровая_история": base["игровая_история"],
        }
    return base


def build_employee_profile(db: Session, employee_id: int, account: Account) -> dict[str, Any]:
    employee = db.scalar(
        select(Employee)
        .where(Employee.id == employee_id)
        .options(selectinload(Employee.account).joinedload(Account.role))
    )
    if employee is None:
        raise HTTPException(status_code=404, detail="Сотрудник не найден.")
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
        "фио": employee.full_name,
        "фото": employee.photo,
        "телефон": employee.phone,
        "должность": employee.position,
        "создано": format_date_ru(employee.created_at),
        "обновлено": format_date_ru(employee.updated_at),
        "игровая_история": [serialize_game_log(item) for item in games],
    }
    if account.role.code != SystemRoleCode.VOLUNTEER and employee.account:
        data["аккаунт"] = {
            "логин": employee.account.login,
            "роль": role_display_name(employee.account.role.code, employee.account.role.name),
            "заблокирован": employee.account.is_blocked,
        }
    return data


def build_relative_profile(db: Session, relative_id: int, account: Account) -> dict[str, Any]:
    relative = db.scalar(
        select(Relative)
        .where(Relative.id == relative_id)
        .options(selectinload(Relative.relation_links).selectinload(RelationLink.participant))
    )
    if relative is None:
        raise HTTPException(status_code=404, detail="Родитель не найден.")

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
        "тип": "Родитель",
        "entity_type": "relative",
        "id": relative.id,
        "технический_id": relative.id,
        "фио": relative.full_name,
        "фото": relative.photo,
        "телефон": relative.phone,
        "примечание": relative.note,
        "создано": format_date_ru(relative.created_at),
        "обновлено": format_date_ru(relative.updated_at),
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
        "игровая_история": [serialize_game_log(item) for item in games],
    }
    if account.role.code == SystemRoleCode.VOLUNTEER:
        data.pop("примечание", None)
    return data


@app.get(f"{settings.api_prefix}/profiles/{{entity_type}}/{{entity_id}}")
def profile_detail(
    entity_type: Literal["participant", "employee", "relative"],
    entity_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    ensure_tab_access(db, account, "people", AccessLevel.READ)
    if entity_type == "participant":
        data = build_participant_profile(db, entity_id, account)
    elif entity_type == "employee":
        data = build_employee_profile(db, entity_id, account)
    else:
        data = build_relative_profile(db, entity_id, account)

    can_write = get_tab_access_level(db, account.role_id, "people") == AccessLevel.WRITE
    data["доступ"] = {"чтение": True, "изменение": can_write}
    return envelope("Карточка пользователя сформирована.", data)


@app.patch(f"{settings.api_prefix}/profiles/{{entity_type}}/{{entity_id}}")
def profile_update(
    entity_type: Literal["participant", "employee", "relative"],
    entity_id: int,
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    if entity_type == "participant":
        model = db.get(Participant, entity_id)
        if model is None:
            raise HTTPException(status_code=404, detail="Подросток не найден.")
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
            raise HTTPException(status_code=404, detail="Сотрудник не найден.")
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
            raise HTTPException(status_code=404, detail="Родитель не найден.")
        if payload.full_name is not None:
            model.full_name = payload.full_name
        if payload.photo is not None:
            model.photo = payload.photo
        if payload.phone is not None:
            model.phone = payload.phone
        if payload.note is not None:
            model.note = payload.note

    db.commit()
    return envelope("Карточка успешно обновлена.")


@app.post(f"{settings.api_prefix}/profiles/participant/{{participant_id}}/relations")
def profile_add_relation(
    participant_id: int,
    payload: AddRelationRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    relation_payload = RelationCreateRequest(
        participant_id=participant_id,
        relative_id=payload.relative_id,
        relation_type=payload.relation_type,
    )
    return people_create_relation(relation_payload, db, account)


@app.delete(f"{settings.api_prefix}/profiles/participant/{{participant_id}}/relations/{{relation_id}}")
def profile_remove_relation(
    participant_id: int,
    relation_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_people_write(db, account)
    relation = db.get(RelationLink, relation_id)
    if relation is None or relation.participant_id != participant_id:
        raise HTTPException(status_code=404, detail="Связь не найдена.")
    db.delete(relation)
    db.commit()
    return envelope("Связь удалена.")


@app.get(f"{settings.api_prefix}/game-objects")
def list_game_objects(
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    access_profiles = get_tab_access_level(db, account.role_id, "game_profiles")
    access_games = get_tab_access_level(db, account.role_id, "games")
    if max(ACCESS_RANK[access_profiles], ACCESS_RANK[access_games]) < ACCESS_RANK[AccessLevel.READ]:
        raise HTTPException(status_code=403, detail="Недостаточно прав на просмотр игровых объектов.")

    objects = db.scalars(select(GameObject).order_by(GameObject.name.asc())).all()
    return envelope(
        "Игровые объекты загружены.",
        [
            {
                "id": obj.id,
                "название": obj.name,
                "тип": obj.object_type.value,
                "цена": obj.price,
                "параметры": obj.parameters,
            }
            for obj in objects
        ],
    )


@app.post(f"{settings.api_prefix}/game-objects")
def create_game_object(
    payload: GameObjectCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_game_profiles_write(db, account)
    game_object = GameObject(
        name=payload.name,
        object_type=GameObjectType(payload.object_type),
        price=payload.price,
        parameters=payload.parameters,
    )
    db.add(game_object)
    db.commit()
    return envelope("Игровой объект добавлен.")


@app.patch(f"{settings.api_prefix}/game-objects/{{object_id}}")
def update_game_object(
    object_id: int,
    payload: GameObjectUpdateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_game_profiles_write(db, account)
    game_object = db.get(GameObject, object_id)
    if game_object is None:
        raise HTTPException(status_code=404, detail="Игровой объект не найден.")
    if payload.name is not None:
        game_object.name = payload.name
    if payload.object_type is not None:
        game_object.object_type = GameObjectType(payload.object_type)
    if payload.price is not None:
        game_object.price = payload.price
    if payload.parameters is not None:
        game_object.parameters = payload.parameters
    db.commit()
    return envelope("Игровой объект обновлен.")


@app.delete(f"{settings.api_prefix}/game-objects/{{object_id}}")
def delete_game_object(
    object_id: int,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_game_profiles_write(db, account)
    game_object = db.get(GameObject, object_id)
    if game_object is None:
        raise HTTPException(status_code=404, detail="Игровой объект не найден.")
    db.delete(game_object)
    db.commit()
    return envelope("Игровой объект удален.")


@app.get(f"{settings.api_prefix}/game-profiles/bootstrap")
def game_profiles_bootstrap(
    query: str | None = Query(default=None),
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    access = ensure_tab_access(db, account, "game_profiles", AccessLevel.READ)
    stmt = (
        select(GameProfile)
        .options(joinedload(GameProfile.participant))
        .order_by(GameProfile.hero_name.asc())
    )
    if query and query.strip():
        pattern = f"%{query.strip()}%"
        stmt = stmt.join(Participant).where(
            (GameProfile.hero_name.ilike(pattern)) | (Participant.full_name.ilike(pattern))
        )
    profiles = db.scalars(stmt).all()

    participants_without_profile = db.scalars(
        select(Participant)
        .outerjoin(GameProfile, GameProfile.participant_id == Participant.id)
        .where(GameProfile.id.is_(None))
        .order_by(Participant.full_name.asc())
    ).all()
    objects = db.scalars(select(GameObject).order_by(GameObject.name.asc())).all()

    return envelope(
        "Игровые профиля загружены.",
        {
            "доступ": access.value,
            "can_write": access == AccessLevel.WRITE,
            "профиля": [
                {
                    "id": profile.id,
                    "participant_id": profile.participant_id,
                    "фио": profile.participant.full_name,
                    "герой": profile.hero_name,
                    "уровень": profile.level,
                    "лут": profile.loot,
                    "ачивки": profile.achievements,
                    "золото": profile.gold,
                }
                for profile in profiles
            ],
            "подростки_без_профиля": [
                {"id": p.id, "фио": p.full_name}
                for p in participants_without_profile
            ],
            "игровые_объекты": [
                {"id": obj.id, "название": obj.name, "тип": obj.object_type.value, "цена": obj.price}
                for obj in objects
            ],
        },
    )


@app.post(f"{settings.api_prefix}/game-profiles")
def create_game_profile(
    payload: GameProfileCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_game_profiles_write(db, account)
    participant = db.get(Participant, payload.participant_id)
    if participant is None:
        raise HTTPException(status_code=404, detail="Подросток не найден.")
    if db.scalar(select(GameProfile).where(GameProfile.participant_id == participant.id)) is not None:
        raise HTTPException(status_code=400, detail="Игровой профиль для этого подростка уже существует.")

    profile = GameProfile(
        participant_id=participant.id,
        hero_name=payload.hero_name,
        level=payload.level,
        loot=0,
        achievements=0,
        gold=0,
    )
    db.add(profile)
    db.commit()
    return envelope("Игровой профиль создан.")


@app.patch(f"{settings.api_prefix}/game-profiles/{{profile_id}}")
def update_game_profile(
    profile_id: int,
    payload: GameProfileCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_game_profiles_write(db, account)
    profile = db.get(GameProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Игровой профиль не найден.")
    profile.hero_name = payload.hero_name
    profile.level = payload.level
    db.commit()
    return envelope("Игровой профиль обновлен.")


@app.post(f"{settings.api_prefix}/game-profiles/{{profile_id}}/quick-action")
def quick_update_game_profile(
    profile_id: int,
    payload: GameProfileQuickRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_game_profiles_write(db, account)
    profile = db.get(GameProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Игровой профиль не найден.")
    obj = db.get(GameObject, payload.object_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Игровой объект не найден.")

    gold_delta = gold_from_price(obj.price) * payload.quantity
    profile.gold += gold_delta
    if obj.object_type == GameObjectType.LOOT:
        profile.loot += payload.quantity
    elif obj.object_type == GameObjectType.ACHIEVEMENT:
        profile.achievements += payload.quantity
        db.add(
            AchievementLog(
                participant_id=profile.participant_id,
                title=f"Награда: {obj.name}",
                achieved_at=datetime.now(),
            )
        )
    db.commit()
    return envelope("Быстрое обновление профиля выполнено.", {"золото_добавлено": gold_delta})


@app.get(f"{settings.api_prefix}/games/bootstrap")
def games_bootstrap(
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    access = ensure_tab_access(db, account, "games", AccessLevel.READ)
    logs = db.scalars(
        select(GameLog)
        .options(
            joinedload(GameLog.master),
            selectinload(GameLog.participants).joinedload(GameLogParticipant.participant),
            selectinload(GameLog.loot_lines).joinedload(GameLogLoot.game_object),
        )
        .order_by(GameLog.game_date.desc(), GameLog.id.desc())
        .limit(400)
    ).all()
    masters = db.scalars(select(Employee).order_by(Employee.full_name.asc())).all()
    participants = db.scalars(select(Participant).order_by(Participant.full_name.asc())).all()
    objects = db.scalars(select(GameObject).order_by(GameObject.name.asc())).all()

    return envelope(
        "Данные вкладки «Игры» загружены.",
        {
            "доступ": access.value,
            "can_write": access == AccessLevel.WRITE,
            "игры": [
                {
                    "id": log.id,
                    "дата_игры": format_date_ru(log.game_date),
                    "активность": log.activity_name,
                    "мастер": log.master.full_name if log.master else "—",
                    "участники": [row.participant.full_name for row in log.participants],
                    "количество_участников": len(log.participants),
                    "золото_распределено": log.loot_distributed,
                    "лут": [
                        {
                            "название": row.game_object.name if row.game_object else "—",
                            "количество": row.quantity,
                            "золото": row.gold_added,
                        }
                        for row in log.loot_lines
                    ],
                }
                for log in logs
            ],
            "мастера": [{"id": item.id, "фио": item.full_name} for item in masters],
            "подростки": [{"id": item.id, "фио": item.full_name} for item in participants],
            "игровые_объекты": [
                {"id": item.id, "название": item.name, "тип": item.object_type.value, "цена": item.price}
                for item in objects
            ],
        },
    )


@app.post(f"{settings.api_prefix}/games/preview-gold")
def games_preview_gold(
    payload: GoldPreviewRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    ensure_tab_access(db, account, "games", AccessLevel.READ)
    value = gold_from_price(payload.price) * payload.quantity
    return envelope("Предпросмотр золота рассчитан.", {"золото": value})


@app.post(f"{settings.api_prefix}/games")
def create_game(
    payload: GameCreateRequest,
    db: Session = Depends(get_db),
    account: Account = Depends(get_current_account),
) -> dict[str, Any]:
    require_games_write(db, account)
    master = db.get(Employee, payload.master_employee_id)
    if master is None:
        raise HTTPException(status_code=404, detail="Мастер игры не найден.")

    participants = db.scalars(
        select(Participant).where(Participant.id.in_(payload.participant_ids))
    ).all()
    if not participants:
        raise HTTPException(status_code=400, detail="Нужно выбрать хотя бы одного участника.")

    loot_object: GameObject | None = None
    total_gold = 0
    if payload.loot_object_id is not None:
        loot_object = db.get(GameObject, payload.loot_object_id)
        if loot_object is None:
            raise HTTPException(status_code=404, detail="Лут не найден.")
        total_gold = gold_from_price(loot_object.price) * payload.loot_quantity

    try:
        game = GameLog(
            game_date=payload.game_date or date.today(),
            activity_name=payload.activity_name,
            master_employee_id=master.id,
            loot_distributed=total_gold,
            description=payload.description,
        )
        db.add(game)
        db.flush()

        for participant in participants:
            db.add(GameLogParticipant(game_log_id=game.id, participant_id=participant.id))

        if loot_object is not None:
            db.add(
                GameLogLoot(
                    game_log_id=game.id,
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
    except Exception as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Не удалось создать игру: {error}") from error

    return envelope(
        "Игра создана.",
        {
            "id": game.id,
            "дата_игры": format_date_ru(game.game_date),
            "золото_распределено": game.loot_distributed,
        },
    )

