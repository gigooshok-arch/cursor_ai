## ERP-Rassvet (актуальный стек)

Проект полностью переведен на новый стек:

- **Backend:** Python + FastAPI + SQLAlchemy + Pydantic
- **Frontend:** Vue 3 (Vite) + Tailwind CSS
- **База данных:** SQLite (WAL mode)
- **Авторизация:** JWT (Bearer token)

---

## Структура проекта

- `backend/` — API, модели БД, бизнес-логика, сидирование данных
- `frontend/` — SPA-интерфейс на Vue 3

---

## Что реализовано

- Полная русская локализация UI и API-ответов.
- Роли: **Админ**, **Директор**, **Волонтер**, **Педагог**.
- Автогенерация логина по формуле `familia_ii` (пример: `tymchenko_av`).
- Единая карточка пользователя (`/profile/:entityType/:id`):
  - фото + ФИО,
  - кликабельные связи родственников,
  - игровая история,
  - ролевое отображение данных (read-only для волонтера).
- Расчет золота: `floor(цена / 2)`.
- Транзакционные операции для изменения связей родственников.
- Backend и frontend запускаются на `0.0.0.0` (доступ из локальной сети).

---

## Инструкция по запуску

### Требования

- Python 3.10+
- Node.js 20+
- npm

### 1) Запуск backend (терминал №1)

```bash
cd backend
python3 -m pip install -r requirements.txt
python3 main.py
```

После запуска:
- API: `http://127.0.0.1:8000`
- OpenAPI: `http://127.0.0.1:8000/docs`

### 2) Запуск frontend (терминал №2)

```bash
cd frontend
npm install
npm run dev
```

После запуска:
- Web UI: `http://127.0.0.1:5173`

### 3) Доступ из локальной сети

Так как сервисы слушают `0.0.0.0`, приложение открывается с других устройств по IP машины:

- `http://<LAN_IP>:5173`

Если используется локальный домен `erp-rassvet28.ru`, направьте его на IP машины в локальном DNS/hosts.

---

## Тестовые пользователи

- `tymchenko_av` / `admin123` — Админ
- `ivanova_ms` / `director123` — Директор
- `petrov_na` / `volunteer123` — Волонтер
- `sidorova_ek` / `pedagogue123` — Педагог

---

## Полезные команды

### Backend

```bash
cd backend
python3 -m pytest -q
```

### Frontend

```bash
cd frontend
npm run build
```

---

## Основные API-маршруты

- `POST /api/auth/login` — вход
- `GET /api/auth/me` — текущий пользователь
- `GET /api/dashboard/summary` — сводка
- `GET /api/profiles` — список/поиск профилей
- `GET /api/profiles/{entity_type}/{id}` — карточка пользователя
- `PATCH /api/profiles/{entity_type}/{id}` — редактирование (write-роли)
- `POST /api/profiles/participant/{id}/relations` — добавить связь
- `DELETE /api/profiles/participant/{id}/relations/{relation_id}` — удалить связь
- `POST /api/games/preview-gold` — предпросмотр расчета золота
- `POST /api/games` — создание игрового лога
