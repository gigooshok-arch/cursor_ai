import { AccessLevel } from "@prisma/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/rbac";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await requireAccount();
  await requireTabAccess(account, "dashboard", AccessLevel.READ);
  const params = await searchParams;
  const forbidden = params.forbidden === "1";

  const [participants, employees, gameProfiles, gameLogs] = await Promise.all([
    prisma.participant.count(),
    prisma.employee.count(),
    prisma.gameProfile.count(),
    prisma.gameLog.count(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">ERP-Rassvet</h1>
        <p className="text-sm text-slate-600">
          Локальная ERP на Next.js + Prisma + SQLite с динамическими правами и вкладками.
        </p>
        {forbidden ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Недостаточно прав для выбранной вкладки.
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Участники</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{participants}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Сотрудники</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{employees}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Игровые профили</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{gameProfiles}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Игровые логи</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{gameLogs}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
