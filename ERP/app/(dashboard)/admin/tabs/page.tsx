import { AccessLevel } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTabAccessForRole, isAccessAllowed, requireTabAccess } from "@/lib/rbac";

async function createTabAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "admin_tabs", AccessLevel.WRITE);

  const title = String(formData.get("title") ?? "").trim();
  const key = String(formData.get("key") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
  const route = String(formData.get("route") ?? "").trim();
  const sqlViewName = String(formData.get("sqlViewName") ?? "").trim() || null;
  const order = Number(formData.get("order") ?? 0);

  if (!title || !key || !route) {
    return;
  }

  const roles = await prisma.role.findMany({ select: { id: true } });

  await prisma.$transaction(async (tx) => {
    const tab = await tx.navTab.create({
      data: {
        title,
        key,
        route,
        sqlViewName,
        order: Number.isFinite(order) ? order : 0,
        isEnabled: true,
      },
    });

    if (roles.length) {
      await tx.permission.createMany({
        data: roles.map((role) => ({
          roleId: role.id,
          tabId: tab.id,
          access: AccessLevel.HIDDEN,
        })),
      });
    }
  });

  revalidatePath("/admin/tabs");
  revalidatePath("/dashboard");
}

async function updateTabAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "admin_tabs", AccessLevel.WRITE);

  const id = Number(formData.get("id"));
  if (!id) {
    return;
  }

  const title = String(formData.get("title") ?? "").trim();
  const route = String(formData.get("route") ?? "").trim();
  const sqlViewName = String(formData.get("sqlViewName") ?? "").trim() || null;
  const order = Number(formData.get("order") ?? 0);
  const isEnabled = formData.get("isEnabled") === "on";

  await prisma.navTab.update({
    where: { id },
    data: {
      title,
      route,
      sqlViewName,
      order: Number.isFinite(order) ? order : 0,
      isEnabled,
    },
  });
  revalidatePath("/admin/tabs");
  revalidatePath("/dashboard");
}

async function deleteTabAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "admin_tabs", AccessLevel.WRITE);

  const id = Number(formData.get("id"));
  if (!id) {
    return;
  }
  await prisma.navTab.delete({ where: { id } });
  revalidatePath("/admin/tabs");
  revalidatePath("/dashboard");
}

export default async function AdminTabsPage() {
  const account = await requireAccount();
  const access = await getTabAccessForRole(account.roleId, "admin_tabs");
  const canWrite = isAccessAllowed(access, AccessLevel.WRITE);
  await requireTabAccess(account, "admin_tabs", AccessLevel.READ);

  const tabs = await prisma.navTab.findMany({
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Администрирование: вкладки меню</h1>
        <p className="text-sm text-slate-600">
          Добавление, переименование и отключение вкладок бокового меню с привязкой к SQL View.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Новая вкладка</CardTitle>
        </CardHeader>
        <CardContent>
          {canWrite ? (
            <form action={createTabAction} className="grid gap-3 md:grid-cols-5">
              <div>
                <Label htmlFor="title">Название</Label>
                <Input id="title" name="title" placeholder="Например, Отчеты" required />
              </div>
              <div>
                <Label htmlFor="key">Ключ</Label>
                <Input id="key" name="key" placeholder="reports" required />
              </div>
              <div>
                <Label htmlFor="route">Путь</Label>
                <Input id="route" name="route" placeholder="/reports" required />
              </div>
              <div>
                <Label htmlFor="sqlViewName">SQL View</Label>
                <Input id="sqlViewName" name="sqlViewName" placeholder="v_reports" />
              </div>
              <div>
                <Label htmlFor="order">Порядок</Label>
                <Input id="order" name="order" type="number" defaultValue={100} />
              </div>
              <Button type="submit" className="md:col-span-5 md:w-fit">
                Добавить вкладку
              </Button>
            </form>
          ) : (
            <p className="text-sm text-slate-500">Доступ только на чтение.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Существующие вкладки</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <tr>
                <TH>ID</TH>
                <TH>Ключ</TH>
                <TH>Параметры</TH>
                {canWrite ? <TH>Удаление</TH> : null}
              </tr>
            </THead>
            <TBody>
              {tabs.map((tab) => (
                <tr key={tab.id}>
                  <TD>{tab.id}</TD>
                  <TD>{tab.key}</TD>
                  <TD>
                    <form action={updateTabAction} className="grid gap-2 md:grid-cols-5">
                      <input type="hidden" name="id" value={tab.id} />
                      <Input name="title" defaultValue={tab.title} readOnly={!canWrite} />
                      <Input name="route" defaultValue={tab.route} readOnly={!canWrite} />
                      <Input name="sqlViewName" defaultValue={tab.sqlViewName ?? ""} readOnly={!canWrite} />
                      <Input
                        name="order"
                        type="number"
                        defaultValue={tab.order}
                        readOnly={!canWrite}
                      />
                      <label className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm">
                        <Checkbox name="isEnabled" defaultChecked={tab.isEnabled} disabled={!canWrite} />
                        Включена
                      </label>
                      {canWrite ? (
                        <Button type="submit" size="sm" variant="outline" className="md:col-span-5 md:w-fit">
                          Сохранить вкладку
                        </Button>
                      ) : null}
                    </form>
                  </TD>
                  {canWrite ? (
                    <TD>
                      <form action={deleteTabAction}>
                        <input type="hidden" name="id" value={tab.id} />
                        <Button type="submit" size="sm" variant="destructive">
                          Удалить
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
    </div>
  );
}
