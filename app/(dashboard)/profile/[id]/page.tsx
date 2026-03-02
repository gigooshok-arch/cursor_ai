import { notFound } from "next/navigation";
import { AccessLevel, GameObjectType, Gender } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { UserCard } from "@/components/profile/user-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { requireAccount } from "@/lib/auth";
import { normalizePhoneRu } from "@/lib/formatting";
import { buildProfileSlug, parseProfileSlug } from "@/lib/profile-slug";
import { prisma } from "@/lib/prisma";
import { getTabAccessForRole, isAccessAllowed, requireTabAccess } from "@/lib/rbac";

function toInt(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") {
    return 0;
  }
  const num = Number(value);
  return Number.isInteger(num) ? num : 0;
}

async function resolveAuditNames(
  createdByAccountId: number | null,
  updatedByAccountId: number | null,
): Promise<{ createdByName: string | null; updatedByName: string | null }> {
  const ids = [createdByAccountId, updatedByAccountId].filter(
    (value): value is number => typeof value === "number" && value > 0,
  );
  if (!ids.length) {
    return { createdByName: null, updatedByName: null };
  }

  const accounts = await prisma.account.findMany({
    where: { id: { in: Array.from(new Set(ids)) } },
    include: { employee: true },
  });
  const map = new Map(accounts.map((account) => [account.id, account.employee.fullName]));

  return {
    createdByName: createdByAccountId ? map.get(createdByAccountId) ?? null : null,
    updatedByName: updatedByAccountId ? map.get(updatedByAccountId) ?? null : null,
  };
}

async function updateParticipantProfileAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "profile", AccessLevel.WRITE);

  const participantId = toInt(formData.get("participantId"));
  if (!participantId) {
    return;
  }

  const ageRaw = toInt(formData.get("age"));
  const genderRaw = String(formData.get("gender") ?? "");
  await prisma.participant.update({
    where: { id: participantId },
    data: {
      fullName: String(formData.get("fullName") ?? "").trim(),
      photo: String(formData.get("photo") ?? "").trim() || null,
      phone: normalizePhoneRu(String(formData.get("phone") ?? "")),
      age: ageRaw > 0 ? ageRaw : null,
      school: String(formData.get("school") ?? "").trim() || null,
      className: String(formData.get("className") ?? "").trim() || null,
      gender: genderRaw ? (genderRaw as Gender) : null,
      note: String(formData.get("note") ?? "").trim() || null,
      updatedByAccountId: account.id,
    },
  });

  revalidatePath(`/profile/${buildProfileSlug("participant", participantId)}`);
  revalidatePath("/people");
}

async function addParticipantRelativeLinkAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "profile", AccessLevel.WRITE);

  const participantId = toInt(formData.get("participantId"));
  const relativeId = toInt(formData.get("relativeId"));
  const relationType = String(formData.get("relationType") ?? "").trim();
  if (!participantId || !relativeId || !relationType) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.relationLink.upsert({
      where: {
        participantId_relativeId_relationType: {
          participantId,
          relativeId,
          relationType,
        },
      },
      update: {},
      create: { participantId, relativeId, relationType },
    });

    await tx.participant.update({
      where: { id: participantId },
      data: { updatedByAccountId: account.id },
    });
  });

  revalidatePath(`/profile/${buildProfileSlug("participant", participantId)}`);
  revalidatePath("/people");
}

async function deleteParticipantRelativeLinkAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "profile", AccessLevel.WRITE);

  const participantId = toInt(formData.get("participantId"));
  const linkId = toInt(formData.get("linkId"));
  if (!participantId || !linkId) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.relationLink.delete({ where: { id: linkId } });
    await tx.participant.update({
      where: { id: participantId },
      data: { updatedByAccountId: account.id },
    });
  });

  revalidatePath(`/profile/${buildProfileSlug("participant", participantId)}`);
  revalidatePath("/people");
}

async function updateEmployeeProfileAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "profile", AccessLevel.WRITE);

  const employeeId = toInt(formData.get("employeeId"));
  if (!employeeId) {
    return;
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const [surname = "", name = "", patronymic = ""] = fullName.split(/\s+/);

  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      fullName,
      surname,
      name,
      patronymic: patronymic || null,
      position: String(formData.get("position") ?? "").trim() || null,
      phone: normalizePhoneRu(String(formData.get("phone") ?? "")),
      isActivist: formData.get("isActivist") === "on",
      updatedByAccountId: account.id,
    },
  });

  revalidatePath(`/profile/${buildProfileSlug("employee", employeeId)}`);
  revalidatePath("/people");
}

async function updateRelativeProfileAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "profile", AccessLevel.WRITE);

  const relativeId = toInt(formData.get("relativeId"));
  if (!relativeId) {
    return;
  }

  await prisma.relative.update({
    where: { id: relativeId },
    data: {
      fullName: String(formData.get("fullName") ?? "").trim(),
      phone: normalizePhoneRu(String(formData.get("phone") ?? "")),
      note: String(formData.get("note") ?? "").trim() || null,
      updatedByAccountId: account.id,
    },
  });

  revalidatePath(`/profile/${buildProfileSlug("relative", relativeId)}`);
  revalidatePath("/people");
}

async function addRelativeParticipantLinkAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "profile", AccessLevel.WRITE);

  const relativeId = toInt(formData.get("relativeId"));
  const participantId = toInt(formData.get("participantId"));
  const relationType = String(formData.get("relationType") ?? "").trim();
  if (!relativeId || !participantId || !relationType) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.relationLink.upsert({
      where: {
        participantId_relativeId_relationType: {
          participantId,
          relativeId,
          relationType,
        },
      },
      create: {
        participantId,
        relativeId,
        relationType,
      },
      update: {},
    });
    await tx.relative.update({
      where: { id: relativeId },
      data: { updatedByAccountId: account.id },
    });
  });

  revalidatePath(`/profile/${buildProfileSlug("relative", relativeId)}`);
  revalidatePath("/people");
}

async function removeRelativeParticipantLinkAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "profile", AccessLevel.WRITE);

  const relativeId = toInt(formData.get("relativeId"));
  const linkId = toInt(formData.get("linkId"));
  if (!relativeId || !linkId) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.relationLink.delete({ where: { id: linkId } });
    await tx.relative.update({
      where: { id: relativeId },
      data: { updatedByAccountId: account.id },
    });
  });

  revalidatePath(`/profile/${buildProfileSlug("relative", relativeId)}`);
  revalidatePath("/people");
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const account = await requireAccount();
  const access = await getTabAccessForRole(account.roleId, "profile");
  const canWrite = isAccessAllowed(access, AccessLevel.WRITE);
  await requireTabAccess(account, "profile", AccessLevel.READ);

  const { id } = await params;
  const parsed = parseProfileSlug(id);
  if (!parsed) {
    notFound();
  }

  if (parsed.entityType === "participant") {
    const participant = await prisma.participant.findUnique({
      where: { id: parsed.id },
      include: {
        relativityLinks: {
          include: {
            relative: true,
          },
          orderBy: { id: "desc" },
        },
        gameProfile: true,
      },
    });
    if (!participant) {
      notFound();
    }

    const [games, latestAchievements, relativesForOptions] = await Promise.all([
      prisma.gameLog.findMany({
        where: {
          participants: {
            some: {
              participantId: participant.id,
            },
          },
        },
        include: { activityType: true, master: true },
        orderBy: { date: "desc" },
      }),
      participant.gameProfile
        ? prisma.gameProfileObjectLog.findMany({
            where: {
              profileId: participant.gameProfile.id,
              object: {
                objectType: GameObjectType.ACHIEVEMENT,
              },
            },
            include: { object: true },
            orderBy: { createdAt: "desc" },
            take: 3,
          })
        : Promise.resolve([]),
      prisma.relative.findMany({
        where: {
          relationLinks: {
            none: {
              participantId: participant.id,
            },
          },
        },
        orderBy: { fullName: "asc" },
      }),
    ]);
    const auditNames = await resolveAuditNames(
      participant.createdByAccountId,
      participant.updatedByAccountId,
    );

    return (
      <UserCard
        roleCode={account.role.code}
        roleName={account.role.name}
        access={access}
        canWrite={canWrite}
        model={{
          type: "participant",
          fullName: participant.fullName,
          photo: participant.photo,
          phone: participant.phone,
          school: participant.school,
          className: participant.className,
          note: participant.note,
          age: participant.age,
          gender: participant.gender,
          relatives: participant.relativityLinks.map((link) => ({
            id: link.id,
            relationType: link.relationType,
            relativeId: link.relativeId,
            relativeFullName: link.relative.fullName,
            relativePhone: link.relative.phone,
          })),
          gameSummary: participant.gameProfile
            ? {
                heroName: participant.gameProfile.heroName,
                gold: participant.gameProfile.gold,
                level: participant.gameProfile.level,
                loot: participant.gameProfile.loot,
                achievements: participant.gameProfile.achievements,
              }
            : null,
          latestAchievements: latestAchievements.map((row) => ({
            id: row.id,
            name: row.object.name,
            createdAt: row.createdAt,
          })),
          games: games.map((game) => ({
            id: game.id,
            date: game.date,
            activityName: game.activityType.name,
            masterName: game.master.fullName,
          })),
        }}
        auditInfo={{
          id: participant.id,
          createdAt: participant.createdAt,
          updatedAt: participant.updatedAt,
          createdByName: auditNames.createdByName,
          updatedByName: auditNames.updatedByName,
        }}
        editContent={
          <>
            <form action={updateParticipantProfileAction} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
              <input type="hidden" name="participantId" value={participant.id} />
              <div>
                <Label htmlFor="fullName">ФИО</Label>
                <Input id="fullName" name="fullName" defaultValue={participant.fullName} required />
              </div>
              <div>
                <Label htmlFor="phone">Телефон</Label>
                <PhoneInput id="phone" name="phone" defaultValue={participant.phone ?? ""} />
              </div>
              <div>
                <Label htmlFor="photo">Фото (URL)</Label>
                <Input id="photo" name="photo" defaultValue={participant.photo ?? ""} />
              </div>
              <div>
                <Label htmlFor="age">Возраст</Label>
                <Input id="age" name="age" type="number" min={1} defaultValue={participant.age ?? ""} />
              </div>
              <div>
                <Label htmlFor="school">Школа</Label>
                <Input id="school" name="school" defaultValue={participant.school ?? ""} />
              </div>
              <div>
                <Label htmlFor="className">Класс</Label>
                <Input id="className" name="className" defaultValue={participant.className ?? ""} />
              </div>
              <div>
                <Label htmlFor="gender">Пол</Label>
                <Select id="gender" name="gender" defaultValue={participant.gender ?? ""}>
                  <option value="">Не указан</option>
                  <option value="MALE">Мужской</option>
                  <option value="FEMALE">Женский</option>
                  <option value="OTHER">Другой</option>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="note">Примечание</Label>
                <Textarea id="note" name="note" defaultValue={participant.note ?? ""} />
              </div>
              <Button type="submit" className="md:col-span-2 md:w-fit">
                Сохранить изменения
              </Button>
            </form>

            <form action={addParticipantRelativeLinkAction} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
              <input type="hidden" name="participantId" value={participant.id} />
              <div>
                <Label htmlFor="relativeId">Родственник</Label>
                <Select id="relativeId" name="relativeId" required>
                  <option value="">Выберите</option>
                  {relativesForOptions.map((relative) => (
                    <option key={relative.id} value={relative.id}>
                      {relative.fullName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="relationType">Тип связи</Label>
                <Input id="relationType" name="relationType" placeholder="мать/отец/опекун" required />
              </div>
              <div className="md:col-span-2 flex items-end">
                <Button type="submit">Добавить связь</Button>
              </div>
            </form>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-medium">Удалить связь</h3>
              {participant.relativityLinks.map((link) => (
                <form
                  key={link.id}
                  action={deleteParticipantRelativeLinkAction}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
                >
                  <input type="hidden" name="participantId" value={participant.id} />
                  <input type="hidden" name="linkId" value={link.id} />
                  <p className="text-sm">
                    {link.relative.fullName} ({link.relationType})
                  </p>
                  <Button type="submit" size="sm" variant="destructive">
                    Удалить
                  </Button>
                </form>
              ))}
              {!participant.relativityLinks.length ? (
                <p className="text-sm text-slate-500">Связей нет.</p>
              ) : null}
            </div>
          </>
        }
      />
    );
  }

  if (parsed.entityType === "employee") {
    const employee = await prisma.employee.findUnique({
      where: { id: parsed.id },
      include: {
        account: {
          include: {
            role: true,
          },
        },
      },
    });
    if (!employee) {
      notFound();
    }

    const games = await prisma.gameLog.findMany({
      where: { masterId: employee.id },
      include: {
        activityType: true,
        master: true,
      },
      orderBy: { date: "desc" },
      take: 50,
    });
    const auditNames = await resolveAuditNames(
      employee.createdByAccountId,
      employee.updatedByAccountId,
    );

    return (
      <UserCard
        roleCode={account.role.code}
        roleName={account.role.name}
        access={access}
        canWrite={canWrite}
        model={{
          type: "employee",
          fullName: employee.fullName,
          phone: employee.phone,
          position: employee.position,
          isActivist: employee.isActivist,
          account: employee.account
            ? {
                login: employee.account.login,
                roleName: employee.account.role.name,
                roleCode: employee.account.role.code,
                isBlocked: employee.account.isBlocked,
                forcePasswordChange: employee.account.forcePasswordChange,
              }
            : null,
          gamesAsMaster: games.map((game) => ({
            id: game.id,
            date: game.date,
            activityName: game.activityType.name,
            masterName: game.master.fullName,
          })),
        }}
        auditInfo={{
          id: employee.id,
          createdAt: employee.createdAt,
          updatedAt: employee.updatedAt,
          createdByName: auditNames.createdByName,
          updatedByName: auditNames.updatedByName,
        }}
        editContent={
          <form action={updateEmployeeProfileAction} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
            <input type="hidden" name="employeeId" value={employee.id} />
            <div>
              <Label htmlFor="fullName">ФИО</Label>
              <Input id="fullName" name="fullName" defaultValue={employee.fullName} required />
            </div>
            <div>
              <Label htmlFor="phone">Телефон</Label>
              <PhoneInput id="phone" name="phone" defaultValue={employee.phone ?? ""} />
            </div>
            <div>
              <Label htmlFor="position">Должность</Label>
              <Input id="position" name="position" defaultValue={employee.position ?? ""} />
            </div>
            <label className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm">
              <input type="checkbox" name="isActivist" defaultChecked={employee.isActivist} />
              Активист
            </label>
            <Button type="submit" className="md:col-span-2 md:w-fit">
              Сохранить изменения
            </Button>
          </form>
        }
      />
    );
  }

  const relative = await prisma.relative.findUnique({
    where: { id: parsed.id },
    include: {
      relationLinks: {
        include: {
          participant: true,
        },
      },
    },
  });
  if (!relative) {
    notFound();
  }

  const participantIds = relative.relationLinks.map((link) => link.participantId);
  const [games, participantOptions] = await Promise.all([
    participantIds.length
      ? prisma.gameLog.findMany({
          where: {
            participants: {
              some: {
                participantId: {
                  in: participantIds,
                },
              },
            },
          },
          include: { activityType: true, master: true },
          orderBy: { date: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    prisma.participant.findMany({
      where: {
        relativityLinks: {
          none: {
            relativeId: relative.id,
          },
        },
      },
      orderBy: { fullName: "asc" },
    }),
  ]);
  const auditNames = await resolveAuditNames(
    relative.createdByAccountId,
    relative.updatedByAccountId,
  );

  return (
    <UserCard
      roleCode={account.role.code}
      roleName={account.role.name}
      access={access}
      canWrite={canWrite}
      model={{
        type: "relative",
        fullName: relative.fullName,
        phone: relative.phone,
        note: relative.note,
        participants: relative.relationLinks.map((link) => ({
          participantId: link.participantId,
          participantName: link.participant.fullName,
          relationType: link.relationType,
          participantPhone: link.participant.phone,
        })),
        games: games.map((game) => ({
          id: game.id,
          date: game.date,
          activityName: game.activityType.name,
          masterName: game.master.fullName,
        })),
      }}
      auditInfo={{
        id: relative.id,
        createdAt: relative.createdAt,
        updatedAt: relative.updatedAt,
        createdByName: auditNames.createdByName,
        updatedByName: auditNames.updatedByName,
      }}
      editContent={
        <>
          <form action={updateRelativeProfileAction} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2">
            <input type="hidden" name="relativeId" value={relative.id} />
            <div>
              <Label htmlFor="fullName">ФИО</Label>
              <Input id="fullName" name="fullName" defaultValue={relative.fullName} required />
            </div>
            <div>
              <Label htmlFor="phone">Телефон</Label>
              <PhoneInput id="phone" name="phone" defaultValue={relative.phone ?? ""} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="note">Примечание</Label>
              <Textarea id="note" name="note" defaultValue={relative.note ?? ""} />
            </div>
            <Button type="submit" className="md:col-span-2 md:w-fit">
              Сохранить изменения
            </Button>
          </form>

          <form action={addRelativeParticipantLinkAction} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4">
            <input type="hidden" name="relativeId" value={relative.id} />
            <div>
              <Label htmlFor="participantId">Участник</Label>
              <Select id="participantId" name="participantId" required>
                <option value="">Выберите</option>
                {participantOptions.map((participant) => (
                  <option key={participant.id} value={participant.id}>
                    {participant.fullName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="relationType">Тип связи</Label>
              <Input id="relationType" name="relationType" placeholder="мать/отец/опекун" required />
            </div>
            <div className="md:col-span-2 flex items-end">
              <Button type="submit">Добавить связь</Button>
            </div>
          </form>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-medium">Удалить связь</h3>
            {relative.relationLinks.map((link) => (
              <form
                key={link.id}
                action={removeRelativeParticipantLinkAction}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-2"
              >
                <input type="hidden" name="relativeId" value={relative.id} />
                <input type="hidden" name="linkId" value={link.id} />
                <p className="text-sm">
                  {link.participant.fullName} ({link.relationType})
                </p>
                <Button type="submit" size="sm" variant="destructive">
                  Удалить
                </Button>
              </form>
            ))}
            {!relative.relationLinks.length ? (
              <p className="text-sm text-slate-500">Связей нет.</p>
            ) : null}
          </div>
        </>
      }
    />
  );
}
