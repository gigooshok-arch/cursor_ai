import bcrypt from "bcryptjs";
import { AccessLevel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { requireAccount } from "@/lib/auth";
import { generateUniqueLogin } from "@/lib/business";
import { buildProfileHref } from "@/lib/profile-slug";
import { prisma } from "@/lib/prisma";
import { getTabAccessForRole, isAccessAllowed, requireTabAccess } from "@/lib/rbac";

async function createAccountAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "admin_accounts", AccessLevel.WRITE);

  const employeeId = Number(formData.get("employeeId"));
  const roleId = Number(formData.get("roleId"));
  const initialPassword = String(formData.get("initialPassword") ?? "pas123").trim() || "pas123";
  if (!employeeId || !roleId) {
    return;
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    return;
  }
  const login = await generateUniqueLogin(prisma, employee.fullName);
  const passwordHash = await bcrypt.hash(initialPassword, 10);

  await prisma.account.create({
    data: {
      employeeId,
      roleId,
      login,
      passwordHash,
      isBlocked: false,
      forcePasswordChange: true,
    },
  });
  revalidatePath("/admin/accounts");
}

async function updateRoleAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "admin_accounts", AccessLevel.WRITE);

  const accountId = Number(formData.get("accountId"));
  const roleId = Number(formData.get("roleId"));
  if (!accountId || !roleId) {
    return;
  }
  await prisma.account.update({
    where: { id: accountId },
    data: { roleId },
  });
  revalidatePath("/admin/accounts");
}

async function toggleBlockAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "admin_accounts", AccessLevel.WRITE);

  const accountId = Number(formData.get("accountId"));
  if (!accountId || accountId === account.id) {
    return;
  }

  const target = await prisma.account.findUnique({ where: { id: accountId } });
  if (!target) {
    return;
  }
  await prisma.account.update({
    where: { id: accountId },
    data: { isBlocked: !target.isBlocked },
  });
  revalidatePath("/admin/accounts");
}

async function resetPasswordAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "admin_accounts", AccessLevel.WRITE);

  const accountId = Number(formData.get("accountId"));
  if (!accountId) {
    return;
  }
  const passwordHash = await bcrypt.hash("pas123", 10);

  await prisma.account.update({
    where: { id: accountId },
    data: {
      passwordHash,
      forcePasswordChange: true,
    },
  });
  revalidatePath("/admin/accounts");
}

async function deleteAccountAction(formData: FormData): Promise<void> {
  "use server";
  const account = await requireAccount();
  await requireTabAccess(account, "admin_accounts", AccessLevel.WRITE);

  const accountId = Number(formData.get("accountId"));
  if (!accountId || accountId === account.id) {
    return;
  }
  await prisma.account.delete({ where: { id: accountId } });
  revalidatePath("/admin/accounts");
}

export default async function AdminAccountsPage() {
  const account = await requireAccount();
  const access = await getTabAccessForRole(account.roleId, "admin_accounts");
  const canWrite = isAccessAllowed(access, AccessLevel.WRITE);
  await requireTabAccess(account, "admin_accounts", AccessLevel.READ);

  const [roles, employees, accounts] = await Promise.all([
    prisma.role.findMany({ orderBy: { id: "asc" } }),
    prisma.employee.findMany({
      where: { account: null },
      orderBy: { fullName: "asc" },
    }),
    prisma.account.findMany({
      include: {
        employee: true,
        role: true,
      },
      orderBy: { id: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Администрирование: доступы</h1>
        <p className="text-sm text-slate-600">
          CRUD аккаунтов, блокировка и сброс паролей с флагом обязательной смены.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Создание аккаунта (логин генерируется автоматически)</CardTitle>
        </CardHeader>
        <CardContent>
          {canWrite ? (
            <form action={createAccountAction} className="grid gap-3 md:grid-cols-4">
              <div>
                <Label htmlFor="employeeId">Сотрудник</Label>
                <Select name="employeeId" id="employeeId" required>
                  <option value="">Выберите сотрудника</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="roleId">Роль</Label>
                <Select name="roleId" id="roleId" required>
                  <option value="">Выберите роль</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="initialPassword">Начальный пароль</Label>
                <Input id="initialPassword" name="initialPassword" defaultValue="pas123" />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  Создать аккаунт
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
          <CardTitle className="text-base">Аккаунты</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <tr>
                <TH>ID</TH>
                <TH>Логин</TH>
                <TH>ФИО сотрудника</TH>
                <TH>Роль</TH>
                <TH>Статус</TH>
                <TH>Смена пароля при входе</TH>
                {canWrite ? <TH>Действия</TH> : null}
              </tr>
            </THead>
            <TBody>
              {accounts.map((item) => (
                <tr key={item.id}>
                  <TD>{item.id}</TD>
                  <TD>{item.login}</TD>
                  <TD>
                    <Link
                      href={buildProfileHref("employee", item.employeeId)}
                      className="font-medium underline"
                    >
                      {item.employee.fullName}
                    </Link>
                  </TD>
                  <TD>
                    {canWrite ? (
                      <form action={updateRoleAction} className="flex min-w-44 items-center gap-2">
                        <input type="hidden" name="accountId" value={item.id} />
                        <Select name="roleId" defaultValue={String(item.roleId)}>
                          {roles.map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </Select>
                        <Button size="sm" variant="outline" type="submit">
                          Сменить
                        </Button>
                      </form>
                    ) : (
                      item.role.name
                    )}
                  </TD>
                  <TD>
                    <Badge className={item.isBlocked ? "border-rose-300 text-rose-700" : "border-emerald-300 text-emerald-700"}>
                      {item.isBlocked ? "Заблокирован" : "Активен"}
                    </Badge>
                  </TD>
                  <TD>{item.forcePasswordChange ? "true" : "false"}</TD>
                  {canWrite ? (
                    <TD>
                      <div className="flex flex-wrap gap-2">
                        <form action={toggleBlockAction}>
                          <input type="hidden" name="accountId" value={item.id} />
                          <Button size="sm" variant="secondary" type="submit">
                            {item.isBlocked ? "Разблокировать" : "Блокировать"}
                          </Button>
                        </form>
                        <form action={resetPasswordAction}>
                          <input type="hidden" name="accountId" value={item.id} />
                          <Button size="sm" variant="outline" type="submit">
                            Сброс в pas123
                          </Button>
                        </form>
                        <form action={deleteAccountAction}>
                          <input type="hidden" name="accountId" value={item.id} />
                          <Button size="sm" variant="destructive" type="submit">
                            Удалить
                          </Button>
                        </form>
                      </div>
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
