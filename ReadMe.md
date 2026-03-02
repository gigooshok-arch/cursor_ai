## ERP-Rassvet (FastAPI + Vue 3 + SQLite)

Полная пересборка проекта под новый стек:

- **Backend:** FastAPI + SQLAlchemy + Pydantic
- **Frontend:** Vue 3 (Vite) + Tailwind CSS
- **База данных:** SQLite (режим WAL)

## Структура

- `backend/` — API-сервер, авторизация JWT, бизнес-логика, seed-данные.
- `frontend/` — клиентское приложение Vue 3 с русским UI.

## Реализовано по ТЗ

- Полная русская локализация интерфейса и API-ответов (`сообщение`, `данные`, русские названия ролей).
- Роли: **Админ**, **Директор**, **Волонтер**, **Педагог**.
- JWT-авторизация.
- Автогенерация логина по формуле `familia_ii` с транслитерацией (`Тымченко Александр Викторович` → `tymchenko_av`).
- Единая карточка пользователя (`/profile/:entityType/:id`) с:
  - фото и ФИО,
  - кликабельными связями родственников,
  - игровой историей,
  - role-aware UX (для волонтера только чтение, без редактирования).
- Расчет золота: `floor(цена / 2)`.
- Транзакционные операции изменения связей в профиле.
- Работа в локальной сети: backend и frontend слушают `0.0.0.0`.

## Быстрый запуск

### 1) Backend

```bash
cd backend
python3 -m pip install -r requirements.txt
python3 main.py
```

API будет доступен на `http://0.0.0.0:8000`.

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend будет доступен на `http://0.0.0.0:5173`.

## Тестовые пользователи

- `tymchenko_av` / `admin123` — Админ
- `ivanova_ms` / `director123` — Директор
- `petrov_na` / `volunteer123` — Волонтер
- `sidorova_ek` / `pedagogue123` — Педагог

## Ключевые API-маршруты

- `POST /api/auth/login` — вход.
- `GET /api/auth/me` — текущий пользователь.
- `GET /api/dashboard/summary` — сводка.
- `GET /api/profiles` — поиск профилей.
- `GET /api/profiles/{entity_type}/{id}` — карточка пользователя.
- `PATCH /api/profiles/{entity_type}/{id}` — редактирование (только write-роли).
- `POST /api/profiles/participant/{id}/relations` — добавить связь.
- `DELETE /api/profiles/participant/{id}/relations/{relation_id}` — удалить связь.
- `POST /api/games/preview-gold` — расчет золота.
- `POST /api/games` — запись игрового лога.
