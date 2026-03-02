from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .business import generate_unique_login, gold_from_price
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
    Role,
    RoleCode,
)
from .security import hash_password


def _ensure_role(db: Session, code: RoleCode, name: str) -> Role:
    role = db.scalar(select(Role).where(Role.code == code))
    if role is None:
        role = Role(code=code, name=name)
        db.add(role)
        db.flush()
        return role
    role.name = name
    return role


def _ensure_employee(
    db: Session,
    full_name: str,
    position: str,
    phone: str,
    photo: str | None = None,
) -> Employee:
    employee = db.scalar(select(Employee).where(Employee.full_name == full_name))
    if employee is None:
        employee = Employee(
            full_name=full_name,
            position=position,
            phone=phone,
            photo=photo,
        )
        db.add(employee)
        db.flush()
        return employee

    employee.position = position
    employee.phone = phone
    employee.photo = photo
    return employee


def _ensure_account(
    db: Session,
    employee: Employee,
    role: Role,
    password: str,
) -> Account:
    account = db.scalar(select(Account).where(Account.employee_id == employee.id))
    if account is None:
        account = Account(
            employee_id=employee.id,
            role_id=role.id,
            login=generate_unique_login(db, employee.full_name),
            password_hash=hash_password(password),
            is_blocked=False,
            force_password_change=False,
        )
        db.add(account)
        db.flush()
        return account

    account.role_id = role.id
    account.password_hash = hash_password(password)
    account.is_blocked = False
    account.force_password_change = False
    return account


def _ensure_participant(
    db: Session,
    *,
    full_name: str,
    photo: str | None,
    phone: str,
    age: int,
    school: str,
    class_name: str,
    note: str,
) -> Participant:
    participant = db.scalar(select(Participant).where(Participant.full_name == full_name))
    if participant is None:
        participant = Participant(
            full_name=full_name,
            photo=photo,
            phone=phone,
            age=age,
            school=school,
            class_name=class_name,
            note=note,
        )
        db.add(participant)
        db.flush()
        return participant

    participant.photo = photo
    participant.phone = phone
    participant.age = age
    participant.school = school
    participant.class_name = class_name
    participant.note = note
    return participant


def _ensure_relative(
    db: Session,
    *,
    full_name: str,
    photo: str | None,
    phone: str,
    note: str,
) -> Relative:
    relative = db.scalar(select(Relative).where(Relative.full_name == full_name))
    if relative is None:
        relative = Relative(
            full_name=full_name,
            photo=photo,
            phone=phone,
            note=note,
        )
        db.add(relative)
        db.flush()
        return relative

    relative.photo = photo
    relative.phone = phone
    relative.note = note
    return relative


def _ensure_relation(
    db: Session,
    participant: Participant,
    relative: Relative,
    relation_type: str,
) -> None:
    existing = db.scalar(
        select(RelationLink).where(
            RelationLink.participant_id == participant.id,
            RelationLink.relative_id == relative.id,
            RelationLink.relation_type == relation_type,
        )
    )
    if existing is None:
        db.add(
            RelationLink(
                participant_id=participant.id,
                relative_id=relative.id,
                relation_type=relation_type,
            )
        )


def _ensure_game_object(
    db: Session,
    name: str,
    object_type: GameObjectType,
    price: int,
    parameters: str,
) -> GameObject:
    game_object = db.scalar(select(GameObject).where(GameObject.name == name))
    if game_object is None:
        game_object = GameObject(
            name=name,
            object_type=object_type,
            price=price,
            parameters=parameters,
        )
        db.add(game_object)
        db.flush()
        return game_object

    game_object.object_type = object_type
    game_object.price = price
    game_object.parameters = parameters
    return game_object


def _ensure_profile(
    db: Session,
    participant: Participant,
    hero_name: str,
    level: int,
    loot: int,
    achievements: int,
    gold: int,
) -> GameProfile:
    profile = db.scalar(select(GameProfile).where(GameProfile.participant_id == participant.id))
    if profile is None:
        profile = GameProfile(
            participant_id=participant.id,
            hero_name=hero_name,
            level=level,
            loot=loot,
            achievements=achievements,
            gold=gold,
        )
        db.add(profile)
        db.flush()
        return profile

    profile.hero_name = hero_name
    profile.level = level
    profile.loot = loot
    profile.achievements = achievements
    profile.gold = gold
    return profile


def _ensure_achievement(db: Session, participant: Participant, title: str, achieved_at: datetime) -> None:
    exists = db.scalar(
        select(AchievementLog).where(
            AchievementLog.participant_id == participant.id,
            AchievementLog.title == title,
        )
    )
    if exists is None:
        db.add(
            AchievementLog(
                participant_id=participant.id,
                title=title,
                achieved_at=achieved_at,
            )
        )


def _ensure_game_log(
    db: Session,
    *,
    game_date: date,
    activity_name: str,
    master: Employee,
    participants: list[Participant],
    loot_object: GameObject,
    loot_quantity: int,
    description: str,
) -> None:
    log = db.scalar(
        select(GameLog).where(
            GameLog.game_date == game_date,
            GameLog.activity_name == activity_name,
            GameLog.master_employee_id == master.id,
        )
    )

    total_gold = gold_from_price(loot_object.price) * loot_quantity

    if log is None:
        log = GameLog(
            game_date=game_date,
            activity_name=activity_name,
            master_employee_id=master.id,
            loot_distributed=total_gold,
            description=description,
        )
        db.add(log)
        db.flush()

    existing_participant_ids = {
        row.participant_id
        for row in db.scalars(
            select(GameLogParticipant).where(GameLogParticipant.game_log_id == log.id)
        ).all()
    }
    for participant in participants:
        if participant.id not in existing_participant_ids:
            db.add(GameLogParticipant(game_log_id=log.id, participant_id=participant.id))

    loot_line = db.scalar(select(GameLogLoot).where(GameLogLoot.game_log_id == log.id))
    if loot_line is None:
        db.add(
            GameLogLoot(
                game_log_id=log.id,
                game_object_id=loot_object.id,
                quantity=loot_quantity,
                gold_added=total_gold,
            )
        )


def seed_database(db: Session) -> None:
    admin_role = _ensure_role(db, RoleCode.ADMIN, "Админ")
    director_role = _ensure_role(db, RoleCode.DIRECTOR, "Директор")
    volunteer_role = _ensure_role(db, RoleCode.VOLUNTEER, "Волонтер")
    pedagogue_role = _ensure_role(db, RoleCode.PEDAGOGUE, "Педагог")

    admin_employee = _ensure_employee(
        db,
        full_name="Тымченко Александр Викторович",
        position="Руководитель проекта",
        phone="+7 (999) 000-00-01",
        photo="https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=640",
    )
    director_employee = _ensure_employee(
        db,
        full_name="Иванова Марина Сергеевна",
        position="Директор смены",
        phone="+7 (999) 000-00-02",
        photo="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=640",
    )
    volunteer_employee = _ensure_employee(
        db,
        full_name="Петров Николай Андреевич",
        position="Волонтер",
        phone="+7 (999) 000-00-03",
        photo="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=640",
    )
    pedagogue_employee = _ensure_employee(
        db,
        full_name="Сидорова Екатерина Константиновна",
        position="Педагог",
        phone="+7 (999) 000-00-04",
        photo="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=640",
    )

    _ensure_account(db, admin_employee, admin_role, "admin123")
    _ensure_account(db, director_employee, director_role, "director123")
    _ensure_account(db, volunteer_employee, volunteer_role, "volunteer123")
    _ensure_account(db, pedagogue_employee, pedagogue_role, "pedagogue123")

    participant_1 = _ensure_participant(
        db,
        full_name="Киреев Артем Викторович",
        photo="https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=640",
        phone="+7 (999) 111-22-33",
        age=15,
        school="Школа №12",
        class_name="8А",
        note="Аллергия на орехи. Любит настольные ролевые игры.",
    )
    participant_2 = _ensure_participant(
        db,
        full_name="Романова Мария Сергеевна",
        photo="https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=640",
        phone="+7 (999) 111-22-34",
        age=14,
        school="Лицей №3",
        class_name="7Б",
        note="Особенности поведения: быстро утомляется в шумной среде.",
    )

    relative_1 = _ensure_relative(
        db,
        full_name="Киреев Виктор Алексеевич",
        photo="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=640",
        phone="+7 (999) 222-33-44",
        note="Отец",
    )
    relative_2 = _ensure_relative(
        db,
        full_name="Романова Елена Петровна",
        photo="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=640",
        phone="+7 (999) 222-33-45",
        note="Мать",
    )

    _ensure_relation(db, participant_1, relative_1, "Отец")
    _ensure_relation(db, participant_2, relative_2, "Мать")

    loot_object = _ensure_game_object(
        db,
        name="Сундук с серебром",
        object_type=GameObjectType.LOOT,
        price=120,
        parameters="вес:1",
    )
    _ensure_game_object(
        db,
        name="Медаль героя",
        object_type=GameObjectType.ACHIEVEMENT,
        price=200,
        parameters="ранг:бронза",
    )
    _ensure_game_object(
        db,
        name="Кожаный нагрудник",
        object_type=GameObjectType.GEAR,
        price=90,
        parameters="броня:+3",
    )

    _ensure_profile(
        db,
        participant=participant_1,
        hero_name="Арден Странник",
        level=3,
        loot=6,
        achievements=3,
        gold=40,
    )
    _ensure_profile(
        db,
        participant=participant_2,
        hero_name="Лира Светлая",
        level=2,
        loot=4,
        achievements=2,
        gold=30,
    )

    _ensure_achievement(db, participant_1, "Защитник команды", datetime(2026, 2, 10, 12, 0))
    _ensure_achievement(db, participant_1, "Мастер дипломатии", datetime(2026, 2, 18, 12, 0))
    _ensure_achievement(db, participant_1, "Лидер экспедиции", datetime(2026, 2, 25, 12, 0))
    _ensure_achievement(db, participant_2, "Скрытный следопыт", datetime(2026, 2, 19, 12, 0))
    _ensure_achievement(db, participant_2, "Помощник мастера", datetime(2026, 2, 26, 12, 0))

    _ensure_game_log(
        db,
        game_date=date(2026, 3, 2),
        activity_name="Настольная ролевая игра",
        master=admin_employee,
        participants=[participant_1, participant_2],
        loot_object=loot_object,
        loot_quantity=1,
        description="Тестовая сессия для демонстрации игрового журнала.",
    )

