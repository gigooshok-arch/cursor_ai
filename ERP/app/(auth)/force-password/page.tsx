import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getCurrentAccount,
  logoutCurrentSession,
  updatePasswordForCurrentAccount,
} from "@/lib/auth";

async function changePasswordAction(formData: FormData): Promise<void> {
  "use server";

  const account = await getCurrentAccount();
  if (!account) {
    redirect("/login");
  }

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (password.length < 6) {
    redirect("/force-password?error=Пароль должен быть не короче 6 символов");
  }
  if (password !== confirmPassword) {
    redirect("/force-password?error=Пароли не совпадают");
  }

  await updatePasswordForCurrentAccount(account.id, password);
  redirect("/dashboard");
}

async function logoutAction(): Promise<void> {
  "use server";
  await logoutCurrentSession();
  redirect("/login");
}

export default async function ForcePasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await getCurrentAccount();
  if (!account) {
    redirect("/login");
  }
  if (!account.forcePasswordChange) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const error =
    typeof params.error === "string" ? decodeURIComponent(params.error) : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Смена пароля</CardTitle>
          <CardDescription>
            Первый вход после сброса. Нужно обновить пароль перед продолжением.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={changePasswordAction} className="space-y-4">
            <div>
              <Label htmlFor="password">Новый пароль</Label>
              <Input id="password" name="password" type="password" minLength={6} required />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Повторите пароль</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                minLength={6}
                required
              />
            </div>
            {error ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              Сохранить пароль
            </Button>
          </form>
          <form action={logoutAction} className="mt-3">
            <Button type="submit" variant="outline" className="w-full">
              Выйти
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
