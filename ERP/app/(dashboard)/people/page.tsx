import { AccessLevel, Gender } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireAccount } from "@/lib/auth";
import { splitFullName } from "@/lib/business";
import { normalizePhoneRu } from "@/lib/formatting";
import { buildProfileHref } from "@/lib/profile-slug";
import { prisma } from "@/lib/prisma";
import { getTabAccessForRole, isAccessAllowed, requireTabAccess } from "@/lib/rbac";

async function createEmployeeAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "people", AccessLevel.WRITE);

  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName) {
    return;
  }
  const { surname, name, patronymic } = splitFullName(fullName);

  await prisma.employee.create({
    data: {
      fullName,
      surname,
      name,
      patronymic,
      position: String(formData.get("position") ?? "") || null,
      phone: normalizePhoneRu(String(formData.get("phone") ?? "")),
      isActivist: formData.get("isActivist") === "on",
      createdByAccountId: account.id,
      updatedByAccountId: account.id,
    },
  });
  revalidatePath("/people");
  revalidatePath("/profile");
}

async function updateEmployeeAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "people", AccessLevel.WRITE);

  const id = Number(formData.get("id"));
  const fullName = String(formData.get("fullName") ?? "").trim();
  const { surname, name, patronymic } = splitFullName(fullName);

  await prisma.employee.update({
    where: { id },
    data: {
      fullName,
      surname,
      name,
      patronymic,
      position: String(formData.get("position") ?? "") || null,
      phone: normalizePhoneRu(String(formData.get("phone") ?? "")),
      isActivist: formData.get("isActivist") === "on",
      updatedByAccountId: account.id,
    },
  });
  revalidatePath("/people");
  revalidatePath("/profile");
}

async function bulkDeleteEmployeesAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "people", AccessLevel.WRITE);

  const ids = formData
    .getAll("employeeIds")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!ids.length) {
    return;
  }
  await prisma.$transaction([
    prisma.employee.deleteMany({
      where: { id: { in: ids } },
    }),
  ]);
  revalidatePath("/people");
}

async function createParticipantAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "people", AccessLevel.WRITE);

  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName) {
    return;
  }

  const ageInput = String(formData.get("age") ?? "");
  const age = ageInput ? Number(ageInput) : null;
  const genderRaw = String(formData.get("gender") ?? "");

  await prisma.participant.create({
    data: {
      fullName,
      photo: String(formData.get("photo") ?? "") || null,
      phone: normalizePhoneRu(String(formData.get("phone") ?? "")),
      age: Number.isFinite(age) ? age : null,
      school: String(formData.get("school") ?? "") || null,
      className: String(formData.get("className") ?? "") || null,
      gender: genderRaw ? (genderRaw as Gender) : null,
      note: String(formData.get("note") ?? "") || null,
      createdByAccountId: account.id,
      updatedByAccountId: account.id,
    },
  });
  revalidatePath("/people");
  revalidatePath("/profile");
}

async function updateParticipantAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "people", AccessLevel.WRITE);

  const id = Number(formData.get("id"));
  const ageInput = String(formData.get("age") ?? "");
  const age = ageInput ? Number(ageInput) : null;
  const genderRaw = String(formData.get("gender") ?? "");

  await prisma.participant.update({
    where: { id },
    data: {
      fullName: String(formData.get("fullName") ?? "").trim(),
      photo: String(formData.get("photo") ?? "") || null,
      phone: normalizePhoneRu(String(formData.get("phone") ?? "")),
      age: Number.isFinite(age) ? age : null,
      school: String(formData.get("school") ?? "") || null,
      className: String(formData.get("className") ?? "") || null,
      gender: genderRaw ? (genderRaw as Gender) : null,
      note: String(formData.get("note") ?? "") || null,
      updatedByAccountId: account.id,
    },
  });
  revalidatePath("/people");
  revalidatePath("/profile");
}

async function bulkDeleteParticipantsAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "people", AccessLevel.WRITE);

  const ids = formData
    .getAll("participantIds")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!ids.length) {
    return;
  }
  await prisma.$transaction([
    prisma.participant.deleteMany({
      where: { id: { in: ids } },
    }),
  ]);
  revalidatePath("/people");
}

async function createRelativeAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "people", AccessLevel.WRITE);

  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName) {
    return;
  }

  await prisma.relative.create({
    data: {
      fullName,
      phone: normalizePhoneRu(String(formData.get("phone") ?? "")),
      note: String(formData.get("note") ?? "") || null,
      createdByAccountId: account.id,
      updatedByAccountId: account.id,
    },
  });
  revalidatePath("/people");
  revalidatePath("/profile");
}

async function updateRelativeAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "people", AccessLevel.WRITE);

  const id = Number(formData.get("id"));
  await prisma.relative.update({
    where: { id },
    data: {
      fullName: String(formData.get("fullName") ?? "").trim(),
      phone: normalizePhoneRu(String(formData.get("phone") ?? "")),
      note: String(formData.get("note") ?? "") || null,
      updatedByAccountId: account.id,
    },
  });
  revalidatePath("/people");
  revalidatePath("/profile");
}

async function bulkDeleteRelativesAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "people", AccessLevel.WRITE);

  const ids = formData
    .getAll("relativeIds")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!ids.length) {
    return;
  }
  await prisma.$transaction([
    prisma.relative.deleteMany({
      where: { id: { in: ids } },
    }),
  ]);
  revalidatePath("/people");
}

async function addRelationLinkAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "people", AccessLevel.WRITE);

  const participantId = Number(formData.get("participantId"));
  const relativeId = Number(formData.get("relativeId"));
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
      create: {
        participantId,
        relativeId,
        relationType,
      },
      update: {},
    });
    await tx.participant.update({
      where: { id: participantId },
      data: { updatedByAccountId: account.id },
    });
    await tx.relative.update({
      where: { id: relativeId },
      data: { updatedByAccountId: account.id },
    });
  });
  revalidatePath("/people");
  revalidatePath("/profile");
}

async function removeRelationLinkAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "people", AccessLevel.WRITE);

  const id = Number(formData.get("id"));
  if (!id) {
    return;
  }
  const existing = await prisma.relationLink.findUnique({ where: { id } });
  if (!existing) {
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.relationLink.delete({ where: { id } });
    await tx.participant.update({
      where: { id: existing.participantId },
      data: { updatedByAccountId: account.id },
    });
    await tx.relative.update({
      where: { id: existing.relativeId },
      data: { updatedByAccountId: account.id },
    });
  });
  revalidatePath("/people");
  revalidatePath("/profile");
}

export default async function PeoplePage() {
  const account = await requireAccount();
  const access = await getTabAccessForRole(account.roleId, "people");
  const canWrite = isAccessAllowed(access, AccessLevel.WRITE);
  await requireTabAccess(account, "people", AccessLevel.READ);

  const [employees, participants, relatives, relationLinks] = await Promise.all([
    prisma.employee.findMany({
      include: { account: { include: { role: true } } },
      orderBy: { fullName: "asc" },
    }),
    prisma.participant.findMany({
      include: { gameProfile: true, relativityLinks: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.relative.findMany({
      include: { relationLinks: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.relationLink.findMany({
      include: { participant: true, relative: true },
      orderBy: { id: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Люди</h1>
        <p className="text-sm text-slate-600">
          Массовые операции по сотрудникам, участникам и родственникам с сортировкой ФИО по алфавиту.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Сотрудники</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canWrite ? (
            <form action={createEmployeeAction} className="grid gap-2 md:grid-cols-4">
              <Input name="fullName" placeholder="ФИО" required />
              <Input name="position" placeholder="Должность" />
              <PhoneInput name="phone" placeholder="+7 (___) ___-__-__" />
              <label className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm">
                <Checkbox name="isActivist" />
                Активист
              </label>
              <Button type="submit" className="md:col-span-4 md:w-fit">
                Добавить сотрудника
              </Button>
            </form>
          ) : null}

          <form action={bulkDeleteEmployeesAction} className="space-y-3">
            <Table>
              <THead>
                <tr>
                  {canWrite ? <TH className="w-12">#</TH> : null}
                  <TH>ФИО</TH>
                  <TH>Должность</TH>
                  <TH>Телефон</TH>
                  <TH>Роль</TH>
                  <TH>Активист</TH>
                </tr>
              </THead>
              <TBody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    {canWrite ? (
                      <TD>
                        <Checkbox name="employeeIds" value={employee.id} />
                      </TD>
                    ) : null}
                    <TD>
                      <Link
                        href={buildProfileHref("employee", employee.id)}
                        className="font-medium underline"
                      >
                        {employee.fullName}
                      </Link>
                    </TD>
                    <TD>{employee.position ?? "—"}</TD>
                    <TD>{normalizePhoneRu(employee.phone) ?? "—"}</TD>
                    <TD>
                      {employee.account ? (
                        <div className="space-y-1">
                          <p>{employee.account.login}</p>
                          <Badge>{employee.account.role.name}</Badge>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD>{employee.isActivist ? "Да" : "Нет"}</TD>
                  </tr>
                ))}
              </TBody>
            </Table>
            {canWrite ? (
              <Button type="submit" variant="destructive">
                Удалить выбранных сотрудников
              </Button>
            ) : null}
          </form>
          {canWrite ? (
            <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Редактировать сотрудников
              </summary>
              <div className="mt-3 space-y-3">
                {employees.map((employee) => (
                  <form key={employee.id} action={updateEmployeeAction} className="grid gap-2 md:grid-cols-4 rounded-md border border-slate-200 bg-white p-3">
                    <input type="hidden" name="id" value={employee.id} />
                    <Input name="fullName" defaultValue={employee.fullName} required />
                    <Input name="position" defaultValue={employee.position ?? ""} />
                    <PhoneInput name="phone" defaultValue={employee.phone ?? ""} />
                    <label className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm">
                      <Checkbox name="isActivist" defaultChecked={employee.isActivist} />
                      Активист
                    </label>
                    <Button type="submit" size="sm" className="md:col-span-4 md:w-fit">
                      Сохранить изменения
                    </Button>
                  </form>
                ))}
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Участники</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canWrite ? (
            <form action={createParticipantAction} className="grid gap-2 md:grid-cols-4">
              <Input name="fullName" placeholder="ФИО" required />
              <PhoneInput name="phone" placeholder="+7 (___) ___-__-__" />
              <Input name="age" type="number" min={1} placeholder="Возраст" />
              <Input name="school" placeholder="Школа" />
              <Input name="className" placeholder="Класс" />
              <Select name="gender" defaultValue="">
                <option value="">Пол</option>
                <option value="MALE">Мужской</option>
                <option value="FEMALE">Женский</option>
                <option value="OTHER">Другой</option>
              </Select>
              <Input name="photo" placeholder="Фото (URL)" />
              <Textarea name="note" placeholder="Примечание" className="md:col-span-4" />
              <Button type="submit" className="md:col-span-4 md:w-fit">
                Добавить участника
              </Button>
            </form>
          ) : null}

          <form action={bulkDeleteParticipantsAction} className="space-y-3">
            <Table>
              <THead>
                <tr>
                  {canWrite ? <TH className="w-12">#</TH> : null}
                  <TH>ФИО</TH>
                  <TH>Школа/класс</TH>
                  <TH>Телефон</TH>
                  <TH>Золото</TH>
                  <TH>Возраст</TH>
                </tr>
              </THead>
              <TBody>
                {participants.map((participant) => (
                  <tr key={participant.id}>
                    {canWrite ? (
                      <TD>
                        <Checkbox name="participantIds" value={participant.id} />
                      </TD>
                    ) : null}
                    <TD>
                      <Link
                        href={buildProfileHref("participant", participant.id)}
                        className="font-medium underline"
                      >
                        {participant.fullName}
                      </Link>
                    </TD>
                    <TD>
                      {[participant.school, participant.className].filter(Boolean).join(", ") || "—"}
                    </TD>
                    <TD>{normalizePhoneRu(participant.phone) ?? "—"}</TD>
                    <TD>{participant.gameProfile?.gold ?? "—"}</TD>
                    <TD>{participant.age ?? "—"}</TD>
                  </tr>
                ))}
              </TBody>
            </Table>
            {canWrite ? (
              <Button type="submit" variant="destructive">
                Удалить выбранных участников
              </Button>
            ) : null}
          </form>
          {canWrite ? (
            <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Редактировать участников
              </summary>
              <div className="mt-3 space-y-3">
                {participants.map((participant) => (
                  <form key={participant.id} action={updateParticipantAction} className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-4">
                    <input type="hidden" name="id" value={participant.id} />
                    <Input name="fullName" defaultValue={participant.fullName} required />
                    <PhoneInput name="phone" defaultValue={participant.phone ?? ""} />
                    <Input name="age" type="number" min={1} defaultValue={participant.age ?? ""} />
                    <Input name="school" defaultValue={participant.school ?? ""} />
                    <Input name="className" defaultValue={participant.className ?? ""} />
                    <Select name="gender" defaultValue={participant.gender ?? ""}>
                      <option value="">Пол</option>
                      <option value="MALE">Мужской</option>
                      <option value="FEMALE">Женский</option>
                      <option value="OTHER">Другой</option>
                    </Select>
                    <Input name="photo" defaultValue={participant.photo ?? ""} />
                    <Textarea
                      name="note"
                      defaultValue={participant.note ?? ""}
                      className="md:col-span-4"
                    />
                    <Button type="submit" size="sm" className="md:col-span-4 md:w-fit">
                      Сохранить изменения
                    </Button>
                  </form>
                ))}
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Родственники и связи</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canWrite ? (
            <>
              <form action={createRelativeAction} className="grid gap-2 md:grid-cols-3">
                <Input name="fullName" placeholder="ФИО родственника" required />
                <PhoneInput name="phone" placeholder="+7 (___) ___-__-__" />
                <Input name="note" placeholder="Примечание" />
                <Button type="submit" className="md:col-span-3 md:w-fit">
                  Добавить родственника
                </Button>
              </form>

              <form action={addRelationLinkAction} className="grid gap-2 md:grid-cols-4">
                <div>
                  <Label htmlFor="participantId">Участник</Label>
                  <Select id="participantId" name="participantId" required>
                    <option value="">Выберите</option>
                    {participants.map((participant) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.fullName}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="relativeId">Родственник</Label>
                  <Select id="relativeId" name="relativeId" required>
                    <option value="">Выберите</option>
                    {relatives.map((relative) => (
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
                <div className="flex items-end">
                  <Button type="submit" className="w-full">
                    Добавить связь
                  </Button>
                </div>
              </form>
            </>
          ) : null}

          <form action={bulkDeleteRelativesAction} className="space-y-3">
            <Table>
              <THead>
                <tr>
                  {canWrite ? <TH className="w-12">#</TH> : null}
                  <TH>ФИО</TH>
                  <TH>Телефон</TH>
                  <TH>Родственники</TH>
                  <TH>Примечание</TH>
                </tr>
              </THead>
              <TBody>
                {relatives.map((relative) => (
                  <tr key={relative.id}>
                    {canWrite ? (
                      <TD>
                        <Checkbox name="relativeIds" value={relative.id} />
                      </TD>
                    ) : null}
                    <TD>
                      <Link
                        href={buildProfileHref("relative", relative.id)}
                        className="font-medium underline"
                      >
                        {relative.fullName}
                      </Link>
                    </TD>
                    <TD>{normalizePhoneRu(relative.phone) ?? "—"}</TD>
                    <TD>{relative.relationLinks.length}</TD>
                    <TD>{relative.note ?? "—"}</TD>
                  </tr>
                ))}
              </TBody>
            </Table>
            {canWrite ? (
              <Button type="submit" variant="destructive">
                Удалить выбранных родственников
              </Button>
            ) : null}
          </form>
          {canWrite ? (
            <details className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Редактировать родственников
              </summary>
              <div className="mt-3 space-y-3">
                {relatives.map((relative) => (
                  <form key={relative.id} action={updateRelativeAction} className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-3">
                    <input type="hidden" name="id" value={relative.id} />
                    <Input name="fullName" defaultValue={relative.fullName} required />
                    <PhoneInput name="phone" defaultValue={relative.phone ?? ""} />
                    <Input name="note" defaultValue={relative.note ?? ""} />
                    <Button type="submit" size="sm" className="md:col-span-3 md:w-fit">
                      Сохранить изменения
                    </Button>
                  </form>
                ))}
              </div>
            </details>
          ) : null}

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <h3 className="font-medium">Последние связи</h3>
            <div className="space-y-2">
              {relationLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-white p-2 text-sm"
                >
                  <span>
                    <Link
                      href={buildProfileHref("participant", link.participantId)}
                      className="font-medium underline"
                    >
                      {link.participant.fullName}
                    </Link>{" "}
                    ↔{" "}
                    <Link
                      href={buildProfileHref("relative", link.relativeId)}
                      className="font-medium underline"
                    >
                      {link.relative.fullName}
                    </Link>{" "}
                    ({link.relationType})
                  </span>
                  {canWrite ? (
                    <form action={removeRelationLinkAction}>
                      <input type="hidden" name="id" value={link.id} />
                      <Button size="sm" variant="outline" type="submit">
                        Удалить связь
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))}
              {!relationLinks.length ? <p className="text-sm text-slate-500">Связей пока нет.</p> : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
