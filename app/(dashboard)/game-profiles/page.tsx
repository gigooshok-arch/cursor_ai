import { AccessLevel, GameObjectType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireAccount } from "@/lib/auth";
import { getProfileCountersByObjectType, goldFromPrice } from "@/lib/business";
import { prisma } from "@/lib/prisma";
import { getTabAccessForRole, isAccessAllowed, requireTabAccess } from "@/lib/rbac";

async function createGameObjectAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "game_profiles", AccessLevel.WRITE);

  const name = String(formData.get("name") ?? "").trim();
  const objectType = String(formData.get("objectType") ?? "ITEM") as GameObjectType;
  const price = Number(formData.get("price") ?? 0);
  const parameters = String(formData.get("parameters") ?? "").trim() || null;

  if (!name || !Number.isFinite(price)) {
    return;
  }

  await prisma.gameObject.create({
    data: {
      name,
      objectType,
      price: Math.max(0, price),
      parameters,
    },
  });
  revalidatePath("/game-profiles");
}

async function createGameProfileAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "game_profiles", AccessLevel.WRITE);

  const participantId = Number(formData.get("participantId"));
  const heroName = String(formData.get("heroName") ?? "").trim();
  const level = Number(formData.get("level") ?? 1);
  if (!participantId || !heroName) {
    return;
  }

  await prisma.gameProfile.create({
    data: {
      participantId,
      heroName,
      level: Number.isFinite(level) ? Math.max(1, level) : 1,
    },
  });
  revalidatePath("/game-profiles");
}

async function fastModeLootAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "game_profiles", AccessLevel.WRITE);

  const profileId = Number(formData.get("profileId"));
  const objectId = Number(formData.get("objectId"));
  const quantity = Math.max(1, Number(formData.get("quantity") ?? 1));
  if (!profileId || !objectId) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const object = await tx.gameObject.findUnique({ where: { id: objectId } });
    if (!object) {
      return;
    }
    const goldAdded = goldFromPrice(object.price, quantity);
    const counters = getProfileCountersByObjectType(object.objectType, quantity);

    await tx.gameProfile.update({
      where: { id: profileId },
      data: {
        loot: { increment: counters.loot },
        achievements: { increment: counters.achievements },
        gold: { increment: goldAdded },
      },
    });

    await tx.gameProfileObjectLog.create({
      data: {
        profileId,
        objectId,
        quantity,
        goldAdded,
      },
    });
  });
  revalidatePath("/game-profiles");
}

async function updateProfileLevelAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "game_profiles", AccessLevel.WRITE);

  const profileId = Number(formData.get("profileId"));
  const level = Number(formData.get("level") ?? 1);
  if (!profileId) {
    return;
  }
  await prisma.gameProfile.update({
    where: { id: profileId },
    data: {
      level: Number.isFinite(level) ? Math.max(1, level) : 1,
    },
  });
  revalidatePath("/game-profiles");
}

export default async function GameProfilesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await requireAccount();
  const access = await getTabAccessForRole(account.roleId, "game_profiles");
  const canWrite = isAccessAllowed(access, AccessLevel.WRITE);
  await requireTabAccess(account, "game_profiles", AccessLevel.READ);

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const [profiles, gameObjects, participantsWithoutProfile, latestLootLogs] = await Promise.all([
    prisma.gameProfile.findMany({
      where: q
        ? {
            heroName: {
              contains: q,
            },
          }
        : undefined,
      include: {
        participant: true,
      },
      orderBy: { heroName: "asc" },
    }),
    prisma.gameObject.findMany({
      orderBy: [{ objectType: "asc" }, { name: "asc" }],
    }),
    prisma.participant.findMany({
      where: { gameProfile: null },
      orderBy: { fullName: "asc" },
    }),
    prisma.gameProfileObjectLog.findMany({
      include: {
        profile: true,
        object: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="page-title">Game Profiles</h1>
        <p className="text-sm text-slate-600">
          Fast Mode для мастеров: поиск по герою, добавление лута/достижений и авто-расчет золота.
        </p>
        <form className="max-w-xl" action="/game-profiles" method="get">
          <Label htmlFor="q">Поиск героя</Label>
          <div className="flex gap-2">
            <Input id="q" name="q" defaultValue={q} placeholder="Введите имя героя" />
            <Button type="submit">Найти</Button>
          </div>
        </form>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fast Mode</CardTitle>
        </CardHeader>
        <CardContent>
          {canWrite ? (
            <form action={fastModeLootAction} className="grid gap-3 md:grid-cols-4">
              <div>
                <Label htmlFor="profileId">Герой</Label>
                <Select name="profileId" id="profileId" required>
                  <option value="">Выберите героя</option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.heroName} ({profile.participant.fullName})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="objectId">Объект</Label>
                <Select name="objectId" id="objectId" required>
                  <option value="">Выберите объект</option>
                  {gameObjects.map((object) => (
                    <option key={object.id} value={object.id}>
                      {object.name} [{object.objectType}] цена {object.price}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity">Количество</Label>
                <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  Добавить в профиль
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-slate-500">Доступ только на чтение.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Игровые профили</CardTitle>
          </CardHeader>
          <CardContent>
            {canWrite ? (
              <form action={createGameProfileAction} className="mb-4 grid gap-2 md:grid-cols-3">
                <Select name="participantId" required>
                  <option value="">Участник без профиля</option>
                  {participantsWithoutProfile.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.fullName}
                    </option>
                  ))}
                </Select>
                <Input name="heroName" placeholder="Имя героя" required />
                <div className="flex gap-2">
                  <Input name="level" type="number" min={1} defaultValue={1} />
                  <Button type="submit">Создать</Button>
                </div>
              </form>
            ) : null}

            <Table>
              <THead>
                <tr>
                  <TH>Герой</TH>
                  <TH>Участник</TH>
                  <TH>Параметры</TH>
                  {canWrite ? <TH>Level</TH> : null}
                </tr>
              </THead>
              <TBody>
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <TD>{profile.heroName}</TD>
                    <TD>{profile.participant.fullName}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-2">
                        <Badge>Loot: {profile.loot}</Badge>
                        <Badge>Achievements: {profile.achievements}</Badge>
                        <Badge>Gold: {profile.gold}</Badge>
                      </div>
                    </TD>
                    {canWrite ? (
                      <TD>
                        <form action={updateProfileLevelAction} className="flex items-center gap-2">
                          <input type="hidden" name="profileId" value={profile.id} />
                          <Input name="level" type="number" min={1} defaultValue={profile.level} />
                          <Button type="submit" size="sm" variant="outline">
                            Сохранить
                          </Button>
                        </form>
                      </TD>
                    ) : null}
                  </tr>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Каталог игровых объектов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {canWrite ? (
              <form action={createGameObjectAction} className="grid gap-2 md:grid-cols-2">
                <Input name="name" placeholder="Название объекта" required />
                <Select name="objectType" defaultValue="ITEM">
                  <option value="ITEM">ITEM</option>
                  <option value="ACHIEVEMENT">ACHIEVEMENT</option>
                  <option value="GEAR">GEAR</option>
                </Select>
                <Input name="price" type="number" min={0} placeholder="Цена" required />
                <Textarea name="parameters" placeholder="Параметры" />
                <Button type="submit" className="md:col-span-2 md:w-fit">
                  Добавить объект
                </Button>
              </form>
            ) : null}

            <Table>
              <THead>
                <tr>
                  <TH>Название</TH>
                  <TH>Тип</TH>
                  <TH>Цена</TH>
                  <TH>Параметры</TH>
                </tr>
              </THead>
              <TBody>
                {gameObjects.map((object) => (
                  <tr key={object.id}>
                    <TD>{object.name}</TD>
                    <TD>{object.objectType}</TD>
                    <TD>{object.price}</TD>
                    <TD>{object.parameters ?? "—"}</TD>
                  </tr>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Последние изменения Fast Mode</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <tr>
                <TH>Дата</TH>
                <TH>Герой</TH>
                <TH>Объект</TH>
                <TH>Количество</TH>
                <TH>Gold Added</TH>
              </tr>
            </THead>
            <TBody>
              {latestLootLogs.map((item) => (
                <tr key={item.id}>
                  <TD>{item.createdAt.toLocaleString("ru-RU")}</TD>
                  <TD>{item.profile.heroName}</TD>
                  <TD>{item.object.name}</TD>
                  <TD>{item.quantity}</TD>
                  <TD>{item.goldAdded}</TD>
                </tr>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
