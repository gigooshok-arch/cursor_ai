## ERP-Rassvet (Next.js + Prisma + SQLite)

ERP-система для НКО «Рассвет» на стеке:

- Next.js (App Router)
- TypeScript
- Tailwind CSS + shadcn-style UI components
- Prisma ORM + SQLite

### Что реализовано

- **Accounts + Employees**
  - аккаунт связан с сотрудником 1:1;
  - авто-генерация логина по формуле `surname_initials` с транслитерацией;
  - блокировка аккаунта;
  - сброс пароля в `pas123` с `forcePasswordChange=true`.
- **RBAC**
  - роли + матрица прав `Hidden / Read / Write`;
  - динамический левый sidebar на основе `Permission` + `NavTab`;
  - отдельная админ-страница для управления вкладками и их SQL view-привязкой.
- **People management**
  - bulk-операции (add/edit/delete) для сотрудников, участников, родственников;
  - M-M связи родственников через `RelationLink`;
  - bulk-операции выполняются через `prisma.$transaction`.
- **Game Profiles**
  - fast mode для мастеров: герой + объект + количество;
  - авто-расчет экономики: `gold = Math.floor(price / 2) * quantity`;
  - журнал последних изменений fast mode.
- **Games**
  - wizard создания лога игры;
  - выбор активности, мастера, участников и inline-редактор лута;
  - история игровых логов;
  - операции создания логов выполняются через `prisma.$transaction`.
- **SQLite WAL**
  - при старте приложения включается `PRAGMA journal_mode=WAL` для многопользовательского доступа.
- **Адаптивность**
  - mobile-first интерфейс;
  - hamburger-меню в sidebar на малых экранах;
  - touch-friendly controls (минимум 44px).

### Быстрый старт

1. Установить зависимости:

`npm install`

2. Поднять схему БД:

`npx prisma db push`

3. Заполнить демо-данными:

`npx prisma db seed`

4. Запустить локальный сервер (с доступом из сети):

`npm run dev`

Сервер слушает `0.0.0.0:3000`.

### Запуск в прод-режиме

`npm run build && npm run start`

### Тестовые пользователи

Создаются сидом:

- `tymchenko_av` / `admin123` (Admin)
- `ivanova_ms` / `director123` (Director)
- `petrov_na` / `volunteer123` (Volunteer)

### Основные пути

- `/login` — вход.
- `/force-password` — обязательная смена пароля после сброса.
- `/dashboard` — главная.
- `/people` — люди (сотрудники/участники/родственники).
- `/game-profiles` — игровые профили и fast mode.
- `/games` — история и мастер создания игр.
- `/admin/accounts` — аккаунты.
- `/admin/roles` — роли и матрица прав.
- `/admin/tabs` — вкладки sidebar.

### Полезные команды

- `npm run lint` — TypeScript-проверка.
- `npm run build` — production build check.
- `npm run db:reset` — пересоздать SQLite и заново посеять данные.
