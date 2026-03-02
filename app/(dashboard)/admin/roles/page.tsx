import { AccessLevel } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { requireAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTabAccessForRole, isAccessAllowed, requireTabAccess } from "@/lib/rbac";

async function createRoleAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "admin_roles", AccessLevel.WRITE);

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
  if (!name || !code) {
    return;
  }

  await prisma.role.create({
    data: { name, code },
  });
  revalidatePath("/admin/roles");
}

async function renameRoleAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "admin_roles", AccessLevel.WRITE);

  const roleId = Number(formData.get("roleId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!roleId || !name) {
    return;
  }
  await prisma.role.update({
    where: { id: roleId },
    data: { name },
  });
  revalidatePath("/admin/roles");
}

async function setPermissionAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "admin_roles", AccessLevel.WRITE);

  const roleId = Number(formData.get("roleId"));
  const tabId = Number(formData.get("tabId"));
  const access = String(formData.get("access") ?? "HIDDEN") as AccessLevel;
  if (!roleId || !tabId) {
    return;
  }

  await prisma.permission.upsert({
    where: { roleId_tabId: { roleId, tabId } },
    create: { roleId, tabId, access },
    update: { access },
  });
  revalidatePath("/admin/roles");
}

export default async function AdminRolesPage() {
  const account = await requireAccount();
  const access = await getTabAccessForRole(account.roleId, "admin_roles");
  const canWrite = isAccessAllowed(access, AccessLevel.WRITE);
  await requireTabAccess(account, "admin_roles", AccessLevel.READ);

  const [roles, tabs, permissions] = await Promise.all([
    prisma.role.findMany({ orderBy: { id: "asc" } }),
    prisma.navTab.findMany({ orderBy: [{ order: "asc" }, { id: "asc" }] }),
    prisma.permission.findMany(),
  ]);

  const permissionMap = new Map<string, AccessLevel>();
  for (const item of permissions) {
    permissionMap.set(`${item.roleId}:${item.tabId}`, item.access);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Administration: Roles matrix</h1>
        <p className="text-sm text-slate-600">
          Матрица прав доступа Hidden / Read / Write для каждой вкладки.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Создание роли</CardTitle>
        </CardHeader>
        <CardContent>
          {canWrite ? (
            <form action={createRoleAction} className="grid gap-3 md:grid-cols-3">
              <div>
                <Label htmlFor="name">Название</Label>
                <Input id="name" name="name" placeholder="Например, Методист" required />
              </div>
              <div>
                <Label htmlFor="code">Код</Label>
                <Input id="code" name="code" placeholder="METHODOLOGIST" required />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  Добавить роль
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-slate-500">Доступ только на чтение.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Переименование ролей</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {roles.map((role) => (
            <form key={role.id} action={renameRoleAction} className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-4">
              <input type="hidden" name="roleId" value={role.id} />
              <div className="md:col-span-1">
                <Label>Код</Label>
                <Input value={role.code} readOnly />
              </div>
              <div className="md:col-span-2">
                <Label>Название</Label>
                <Input name="name" defaultValue={role.name} readOnly={!canWrite} />
              </div>
              <div className="flex items-end">
                {canWrite ? (
                  <Button type="submit" variant="outline" className="w-full">
                    Сохранить
                  </Button>
                ) : (
                  <Button type="button" variant="outline" className="w-full" disabled>
                    Только чтение
                  </Button>
                )}
              </div>
            </form>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Матрица прав</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <tr>
                <TH>Роль \\ Вкладка</TH>
                {tabs.map((tab) => (
                  <TH key={tab.id}>
                    <div className="space-y-1">
                      <p>{tab.title}</p>
                      <p className="text-xs text-slate-500">{tab.sqlViewName ?? "no view"}</p>
                    </div>
                  </TH>
                ))}
              </tr>
            </THead>
            <TBody>
              {roles.map((role) => (
                <tr key={role.id}>
                  <TD>
                    <div>
                      <p className="font-medium">{role.name}</p>
                      <p className="text-xs text-slate-500">{role.code}</p>
                    </div>
                  </TD>
                  {tabs.map((tab) => {
                    const key = `${role.id}:${tab.id}`;
                    const currentAccess = permissionMap.get(key) ?? AccessLevel.HIDDEN;

                    return (
                      <TD key={tab.id}>
                        {canWrite ? (
                          <form action={setPermissionAction} className="flex min-w-36 items-center gap-2">
                            <input type="hidden" name="roleId" value={role.id} />
                            <input type="hidden" name="tabId" value={tab.id} />
                            <Select name="access" defaultValue={currentAccess}>
                              <option value="HIDDEN">Hidden</option>
                              <option value="READ">Read</option>
                              <option value="WRITE">Write</option>
                            </Select>
                            <Button type="submit" size="sm" variant="outline">
                              OK
                            </Button>
                          </form>
                        ) : (
                          currentAccess
                        )}
                      </TD>
                    );
                  })}
                </tr>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
