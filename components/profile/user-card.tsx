import type { ReactNode } from "react";

import type { AccessLevel } from "@prisma/client";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateRu, formatDateTimeRu, normalizePhoneRu } from "@/lib/formatting";
import { buildProfileHref } from "@/lib/profile-slug";

type AuditInfo = {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  createdByName: string | null;
  updatedByName: string | null;
};

type GameHistoryItem = {
  id: number;
  date: Date;
  activityName: string;
  masterName: string;
};

type ParticipantRelativeItem = {
  id: number;
  relationType: string;
  relativeId: number;
  relativeFullName: string;
  relativePhone: string | null;
};

type AchievementItem = {
  id: number;
  name: string;
  createdAt: Date;
};

type ParticipantCardModel = {
  type: "participant";
  fullName: string;
  photo: string | null;
  phone: string | null;
  school: string | null;
  className: string | null;
  note: string | null;
  age: number | null;
  gender: string | null;
  relatives: ParticipantRelativeItem[];
  gameSummary: {
    heroName: string;
    gold: number;
    level: number;
    loot: number;
    achievements: number;
  } | null;
  latestAchievements: AchievementItem[];
  games: GameHistoryItem[];
};

type EmployeeCardModel = {
  type: "employee";
  fullName: string;
  phone: string | null;
  position: string | null;
  isActivist: boolean;
  account: {
    login: string;
    roleName: string;
    roleCode: string;
    isBlocked: boolean;
    forcePasswordChange: boolean;
  } | null;
  gamesAsMaster: GameHistoryItem[];
};

type RelativeCardModel = {
  type: "relative";
  fullName: string;
  phone: string | null;
  note: string | null;
  participants: Array<{
    participantId: number;
    participantName: string;
    relationType: string;
    participantPhone: string | null;
  }>;
  games: GameHistoryItem[];
};

type UserCardModel = ParticipantCardModel | EmployeeCardModel | RelativeCardModel;

type UserCardProps = {
  model: UserCardModel;
  roleCode: string;
  roleName: string;
  access: AccessLevel;
  canWrite: boolean;
  auditInfo: AuditInfo;
  editContent?: ReactNode;
};

function AuditSection({ audit }: { audit: AuditInfo }) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Аудит и техданные (Администратор)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm md:grid-cols-2">
        <p>
          <strong>ID:</strong> {audit.id}
        </p>
        <p>
          <strong>Создано:</strong> {formatDateTimeRu(audit.createdAt)}
        </p>
        <p>
          <strong>Обновлено:</strong> {formatDateTimeRu(audit.updatedAt)}
        </p>
        <p>
          <strong>Автор создания:</strong> {audit.createdByName ?? "—"}
        </p>
        <p>
          <strong>Последний редактор:</strong> {audit.updatedByName ?? "—"}
        </p>
      </CardContent>
    </Card>
  );
}

function GamesBlock({ games }: { games: GameHistoryItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">История активности</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {games.map((game) => (
          <div
            key={game.id}
            className="rounded-md border border-slate-200 bg-slate-50 p-2 text-sm"
          >
            <p>
              <strong>Дата игры:</strong> {formatDateRu(game.date)}
            </p>
            <p>
              <strong>Тип активности:</strong> {game.activityName}
            </p>
            <p>
              <strong>Мастер:</strong> {game.masterName}
            </p>
          </div>
        ))}
        {!games.length ? (
          <p className="text-sm text-slate-500">Игр пока нет.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function UserCard({
  model,
  roleCode,
  roleName,
  access,
  canWrite,
  auditInfo,
  editContent,
}: UserCardProps) {
  const isAdmin = roleCode === "ADMIN";
  const isVolunteer = roleCode === "VOLUNTEER";
  const isPedagogue = roleCode === "PEDAGOGUE" || roleCode === "DIRECTOR";
  const accessLabel =
    access === "WRITE" ? "Изменение" : access === "READ" ? "Чтение" : "Скрыто";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">Карточка пользователя</CardTitle>
              <p className="text-sm text-slate-600">
                Роль просмотрщика: {roleName} · Доступ: {accessLabel}
              </p>
            </div>
            {canWrite ? (
              <a href="#edit-section">
                <Button>Редактировать</Button>
              </a>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {model.type === "participant" ? (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-[160px_1fr]">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  {model.photo ? (
                    <img
                      src={model.photo}
                      alt={model.fullName}
                      className="h-40 w-full object-cover md:h-48"
                    />
                  ) : (
                    <div className="flex h-40 items-center justify-center text-sm text-slate-500 md:h-48">
                      Фото не добавлено
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold">{model.fullName}</h1>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge>Возраст: {model.age ?? "—"}</Badge>
                    <Badge>Пол: {model.gender ?? "—"}</Badge>
                    <Badge>
                      Школа/класс: {[model.school, model.className].filter(Boolean).join(", ") || "—"}
                    </Badge>
                  </div>
                  <p className="text-sm">
                    <strong>Контакт:</strong> {normalizePhoneRu(model.phone) ?? "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {isVolunteer ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Контакты и родственники</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {model.relatives.map((link) => (
                    <div
                      key={link.id}
                      className="rounded-md border border-slate-200 bg-slate-50 p-2"
                    >
                      <p>
                        <Link
                          href={buildProfileHref("relative", link.relativeId)}
                          className="font-medium underline"
                        >
                          {link.relativeFullName}
                        </Link>{" "}
                        — {link.relationType}
                      </p>
                      <p>
                        <strong>Телефон родителя:</strong>{" "}
                        {normalizePhoneRu(link.relativePhone) ?? "—"}
                      </p>
                    </div>
                  ))}
                  {!model.relatives.length ? (
                    <p className="text-slate-500">Родственники не указаны.</p>
                  ) : null}
                </CardContent>
              </Card>
              <GamesBlock games={model.games} />
            </>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      {isPedagogue ? "Срочное" : "Контакты и примечание"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      <strong>Примечание:</strong>{" "}
                      <span className="rounded bg-amber-50 px-1 py-0.5">
                        {model.note || "—"}
                      </span>
                    </p>
                    {model.relatives.map((link) => (
                      <div
                        key={link.id}
                        className="rounded-md border border-slate-200 bg-slate-50 p-2"
                      >
                        <p>
                          <Link
                            href={buildProfileHref("relative", link.relativeId)}
                            className="font-medium underline"
                          >
                            {link.relativeFullName}
                          </Link>{" "}
                          — {link.relationType}
                        </p>
                        <p>
                          <strong>Телефон родителя:</strong>{" "}
                          {normalizePhoneRu(link.relativePhone) ?? "—"}
                        </p>
                      </div>
                    ))}
                    {!model.relatives.length ? (
                      <p className="text-slate-500">Родственники не указаны.</p>
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Игровая сводка</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {model.gameSummary ? (
                      <>
                        <p>
                          <strong>Герой:</strong> {model.gameSummary.heroName}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge>Золото: {model.gameSummary.gold}</Badge>
                          <Badge>Уровень: {model.gameSummary.level}</Badge>
                          <Badge>Лут: {model.gameSummary.loot}</Badge>
                          <Badge>Ачивки: {model.gameSummary.achievements}</Badge>
                        </div>
                        <div>
                          <p className="mb-1 font-medium">
                            Последние 3 достигнутые ачивки:
                          </p>
                          <ul className="list-inside list-disc">
                            {model.latestAchievements.map((item) => (
                              <li key={item.id}>
                                {item.name} ({formatDateRu(item.createdAt)})
                              </li>
                            ))}
                          </ul>
                          {!model.latestAchievements.length ? (
                            <p className="text-slate-500">
                              Достижения пока не зафиксированы.
                            </p>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-500">Игровой профиль еще не создан.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
              <GamesBlock games={model.games} />
            </>
          )}
        </>
      ) : null}

      {model.type === "employee" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{model.fullName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <strong>Телефон:</strong> {normalizePhoneRu(model.phone) ?? "—"}
              </p>
              {!isVolunteer ? (
                <>
                  <p>
                    <strong>Должность:</strong> {model.position ?? "—"}
                  </p>
                  <p>
                    <strong>Активист:</strong> {model.isActivist ? "Да" : "Нет"}
                  </p>
                </>
              ) : null}
              {!isVolunteer && model.account ? (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <p>
                    <strong>Логин:</strong> {model.account.login}
                  </p>
                  <p>
                    <strong>Роль:</strong> {model.account.roleName}
                  </p>
                  <p>
                    <strong>Блокировка:</strong>{" "}
                    {model.account.isBlocked ? "Да" : "Нет"}
                  </p>
                  <p>
                    <strong>Требуется смена пароля:</strong>{" "}
                    {model.account.forcePasswordChange ? "Да" : "Нет"}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
          <GamesBlock games={model.gamesAsMaster} />
        </>
      ) : null}

      {model.type === "relative" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{model.fullName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <strong>Телефон:</strong> {normalizePhoneRu(model.phone) ?? "—"}
              </p>
              {!isVolunteer ? (
                <p>
                  <strong>Примечание:</strong> {model.note ?? "—"}
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Связанные участники</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {model.participants.map((item) => (
                <div
                  key={`${item.participantId}-${item.relationType}`}
                  className="rounded-md border border-slate-200 bg-slate-50 p-2"
                >
                  <p>
                    <Link
                      href={buildProfileHref("participant", item.participantId)}
                      className="font-medium underline"
                    >
                      {item.participantName}
                    </Link>{" "}
                    — {item.relationType}
                  </p>
                  <p>
                    <strong>Телефон участника:</strong>{" "}
                    {normalizePhoneRu(item.participantPhone) ?? "—"}
                  </p>
                </div>
              ))}
              {!model.participants.length ? (
                <p className="text-slate-500">Связанных участников нет.</p>
              ) : null}
            </CardContent>
          </Card>
          <GamesBlock games={model.games} />
        </>
      ) : null}

      {isAdmin ? <AuditSection audit={auditInfo} /> : null}

      {canWrite && editContent ? (
        <div id="edit-section" className="space-y-3">
          <h2 className="text-xl font-semibold">Редактирование</h2>
          {editContent}
        </div>
      ) : null}
    </div>
  );
}
