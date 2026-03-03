import Link from "next/link";

import { AccessLevel } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireAccount } from "@/lib/auth";
import { normalizePhoneRu } from "@/lib/formatting";
import { buildProfileHref } from "@/lib/profile-slug";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/rbac";

export default async function ProfilesIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await requireAccount();
  await requireTabAccess(account, "profile", AccessLevel.READ);

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const participantWhere = q
    ? {
        fullName: {
          contains: q,
        },
      }
    : undefined;

  const [participants, employees, relatives] = await Promise.all([
    prisma.participant.findMany({
      where: participantWhere,
      orderBy: { fullName: "asc" },
      take: 120,
    }),
    prisma.employee.findMany({
      where: participantWhere,
      orderBy: { fullName: "asc" },
      take: 120,
    }),
    prisma.relative.findMany({
      where: participantWhere,
      orderBy: { fullName: "asc" },
      take: 120,
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="page-title">Единые карточки пользователей</h1>
        <p className="text-sm text-slate-600">
          Нажмите на человека, чтобы открыть сквозной профиль `/profile/[id]`.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Поиск</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/profile" method="get" className="flex max-w-xl gap-2">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Поиск по ФИО (сортировка по алфавиту А-Я)"
            />
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-md bg-slate-900 px-4 text-sm font-medium text-white"
            >
              Найти
            </button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Участники</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {participants.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-slate-200 bg-slate-50 p-2"
              >
                <p>
                  <Link
                    href={buildProfileHref("participant", item.id)}
                    className="font-medium underline"
                  >
                    {item.fullName}
                  </Link>
                </p>
                <p>{normalizePhoneRu(item.phone) ?? "—"}</p>
              </div>
            ))}
            {!participants.length ? (
              <p className="text-slate-500">Ничего не найдено.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Сотрудники</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {employees.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-slate-200 bg-slate-50 p-2"
              >
                <p>
                  <Link
                    href={buildProfileHref("employee", item.id)}
                    className="font-medium underline"
                  >
                    {item.fullName}
                  </Link>
                </p>
                <p>{normalizePhoneRu(item.phone) ?? "—"}</p>
              </div>
            ))}
            {!employees.length ? (
              <p className="text-slate-500">Ничего не найдено.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Родственники</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {relatives.map((item) => (
              <div
                key={item.id}
                className="rounded-md border border-slate-200 bg-slate-50 p-2"
              >
                <p>
                  <Link
                    href={buildProfileHref("relative", item.id)}
                    className="font-medium underline"
                  >
                    {item.fullName}
                  </Link>
                </p>
                <p>{normalizePhoneRu(item.phone) ?? "—"}</p>
              </div>
            ))}
            {!relatives.length ? (
              <p className="text-slate-500">Ничего не найдено.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
