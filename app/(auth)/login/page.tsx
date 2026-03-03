import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentAccount, loginByCredentials } from "@/lib/auth";

async function loginAction(formData: FormData): Promise<void> {
  "use server";

  const login = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");

  const result = await loginByCredentials(login, password);
  if (!result.ok) {
    redirect(`/login?error=${encodeURIComponent(result.error ?? "Ошибка входа")}`);
  }

  if (result.forcePasswordChange) {
    redirect("/force-password");
  }
  redirect("/dashboard");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await getCurrentAccount();
  if (account) {
    redirect(account.forcePasswordChange ? "/force-password" : "/dashboard");
  }

  const params = await searchParams;
  const error =
    typeof params.error === "string" ? decodeURIComponent(params.error) : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Вход в ERP-Rassvet</CardTitle>
          <CardDescription>
            Введите логин и пароль. Локальный сервер поддерживает работу по Wi-Fi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="space-y-4">
            <div>
              <Label htmlFor="login">Логин</Label>
              <Input id="login" name="login" required />
            </div>
            <div>
              <Label htmlFor="password">Пароль</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            {error ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              Войти
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
