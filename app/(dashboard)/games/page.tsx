import { AccessLevel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireAccount } from "@/lib/auth";
import { getProfileCountersByObjectType, goldFromPrice } from "@/lib/business";
import { formatDateRu } from "@/lib/formatting";
import { buildProfileHref } from "@/lib/profile-slug";
import { prisma } from "@/lib/prisma";
import { getTabAccessForRole, isAccessAllowed, requireTabAccess } from "@/lib/rbac";

async function createGameLogAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "games", AccessLevel.WRITE);

  const dateRaw = String(formData.get("date") ?? "").trim();
  const activityTypeId = Number(formData.get("activityTypeId"));
  const masterId = Number(formData.get("masterId"));
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const participantIds = formData
    .getAll("participantIds")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const lootObjectIdRaw = String(formData.get("lootObjectId") ?? "");
  const lootQuantityRaw = String(formData.get("lootQuantity") ?? "1");
  const lootObjectId = lootObjectIdRaw ? Number(lootObjectIdRaw) : null;
  const lootQuantity = Math.max(1, Number(lootQuantityRaw));

  if (!activityTypeId || !masterId || !participantIds.length) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const participants = await tx.participant.findMany({
      where: { id: { in: participantIds } },
      include: { gameProfile: true },
    });
    const snapshot = participants.map((participant) => ({
      id: participant.id,
      fullName: participant.fullName,
    }));

    let totalGold = 0;
    let objectType: "ITEM" | "ACHIEVEMENT" | "GEAR" | null = null;
    if (lootObjectId) {
      const object = await tx.gameObject.findUnique({
        where: { id: lootObjectId },
      });
      if (object) {
        totalGold = goldFromPrice(object.price, lootQuantity);
        objectType = object.objectType;
      }
    }

    const gameLog = await tx.gameLog.create({
      data: {
        date: dateRaw ? new Date(dateRaw) : new Date(),
        activityTypeId,
        masterId,
        participantsSnapshot: JSON.stringify(snapshot),
        lootDistributed: totalGold,
        notes,
      },
    });

    await tx.gameLogParticipant.createMany({
      data: participants.map((participant) => ({
        gameLogId: gameLog.id,
        participantId: participant.id,
      })),
    });

    if (lootObjectId && objectType) {
      await tx.gameLogLoot.create({
        data: {
          gameLogId: gameLog.id,
          gameObjectId: lootObjectId,
          quantity: lootQuantity,
          totalGold,
        },
      });

      const perParticipantGold = participants.length
        ? Math.floor(totalGold / participants.length)
        : 0;
      const counters = getProfileCountersByObjectType(objectType, 1);

      for (const participant of participants) {
        if (!participant.gameProfile) {
          continue;
        }
        await tx.gameProfile.update({
          where: { id: participant.gameProfile.id },
          data: {
            gold: { increment: perParticipantGold },
            loot: { increment: counters.loot },
            achievements: { increment: counters.achievements },
          },
        });
      }
    }
  });

  revalidatePath("/games");
  revalidatePath("/game-profiles");
}

export default async function GamesPage() {
  const account = await requireAccount();
  const access = await getTabAccessForRole(account.roleId, "games");
  const canWrite = isAccessAllowed(access, AccessLevel.WRITE);
  await requireTabAccess(account, "games", AccessLevel.READ);

  const [activityTypes, masters, participants, gameObjects, gameLogs] = await Promise.all([
    prisma.activityType.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      orderBy: { fullName: "asc" },
    }),
    prisma.participant.findMany({
      include: { gameProfile: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.gameObject.findMany({
      orderBy: [{ objectType: "asc" }, { name: "asc" }],
    }),
    prisma.gameLog.findMany({
      include: {
        activityType: true,
        master: true,
        participants: {
          include: { participant: true },
        },
        lootLines: {
          include: { gameObject: true },
        },
      },
      orderBy: { date: "desc" },
      take: 40,
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Игры</h1>
        <p className="text-sm text-slate-600">
          История игр и мастер создания логов с встроенным редактором лута/достижений.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Мастер создания игры</CardTitle>
        </CardHeader>
        <CardContent>
          {canWrite ? (
            <form action={createGameLogAction} className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label htmlFor="date">Дата</Label>
                  <Input id="date" name="date" type="datetime-local" />
                </div>
                <div>
                  <Label htmlFor="activityTypeId">Тип активности</Label>
                  <Select id="activityTypeId" name="activityTypeId" required>
                    <option value="">Выберите</option>
                    {activityTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="masterId">Мастер</Label>
                  <Select id="masterId" name="masterId" required>
                    <option value="">Выберите</option>
                    {masters.map((master) => (
                      <option key={master.id} value={master.id}>
                        {master.fullName}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium">Участники игры</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {participants.map((participant) => (
                    <label
                      key={participant.id}
                      className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
                    >
                      <Checkbox name="participantIds" value={participant.id} />
                      <span>
                        {participant.fullName}
                        {participant.gameProfile ? (
                          <span className="ml-1 text-xs text-slate-500">
                            ({participant.gameProfile.heroName})
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium">Редактор лута/достижений</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <Label htmlFor="lootObjectId">Игровой объект</Label>
                    <Select id="lootObjectId" name="lootObjectId" defaultValue="">
                      <option value="">Без лута</option>
                      {gameObjects.map((object) => (
                        <option key={object.id} value={object.id}>
                          {object.name} [{object.objectType}] цена {object.price}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="lootQuantity">Количество</Label>
                    <Input id="lootQuantity" name="lootQuantity" type="number" min={1} defaultValue={1} />
                  </div>
                  <div className="text-xs text-slate-500">
                    Золото рассчитывается автоматически: <strong>Math.floor(price / 2)</strong> × quantity.
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Комментарий</Label>
                <Textarea id="notes" name="notes" placeholder="Итоги, заметки мастера..." />
              </div>

              <Button type="submit">Создать игровой лог</Button>
            </form>
          ) : (
            <p className="text-sm text-slate-500">Доступ только на чтение.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">История игр</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <tr>
                <TH>Дата игры</TH>
                <TH>Активность</TH>
                <TH>Мастер</TH>
                <TH>Участники</TH>
                <TH>Лут / Золото</TH>
              </tr>
            </THead>
            <TBody>
              {gameLogs.map((log) => (
                <tr key={log.id}>
                  <TD>{formatDateRu(log.date)}</TD>
                  <TD>{log.activityType.name}</TD>
                  <TD>
                    <Link
                      href={buildProfileHref("employee", log.masterId)}
                      className="font-medium underline"
                    >
                      {log.master.fullName}
                    </Link>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {log.participants.map((row) => (
                        <Link
                          key={row.id}
                          href={buildProfileHref("participant", row.participantId)}
                          className="inline-flex"
                        >
                          <Badge>{row.participant.fullName}</Badge>
                        </Link>
                      ))}
                    </div>
                  </TD>
                  <TD>
                    <div className="space-y-1">
                      {log.lootLines.map((loot) => (
                        <p key={loot.id} className="text-xs">
                          {loot.gameObject.name} ×{loot.quantity} = {loot.totalGold} золота
                        </p>
                      ))}
                      <p className="font-medium">Итого золота: {log.lootDistributed}</p>
                    </div>
                  </TD>
                </tr>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
