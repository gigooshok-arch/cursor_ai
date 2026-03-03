import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

const AUTH_COOKIE_NAME = "erp_rassvet_session";
const SESSION_TTL_DAYS = 14;

export type AuthAccount = NonNullable<
  Awaited<ReturnType<typeof getCurrentAccount>>
>;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createRawToken(): string {
  return randomBytes(32).toString("hex");
}

async function saveSession(accountId: number, token: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);

  await prisma.session.create({
    data: {
      accountId,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });
}

export async function setAuthCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
}

export async function loginByCredentials(login: string, password: string): Promise<{
  ok: boolean;
  forcePasswordChange?: boolean;
  error?: string;
}> {
  const account = await prisma.account.findUnique({
    where: { login: login.trim().toLowerCase() },
  });

  if (!account) {
    return { ok: false, error: "Неверный логин или пароль." };
  }
  if (account.isBlocked) {
    return { ok: false, error: "Аккаунт заблокирован администратором." };
  }

  const isValidPassword = await bcrypt.compare(password, account.passwordHash);
  if (!isValidPassword) {
    return { ok: false, error: "Неверный логин или пароль." };
  }

  const token = createRawToken();
  await saveSession(account.id, token);
  await setAuthCookie(token);

  return { ok: true, forcePasswordChange: account.forcePasswordChange };
}

export async function getCurrentAccount() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      account: {
        include: {
          employee: true,
          role: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }
  if (session.account.isBlocked) {
    return null;
  }

  return session.account;
}

export async function requireAccount(): Promise<AuthAccount> {
  const account = await getCurrentAccount();
  if (!account) {
    redirect("/login");
  }
  return account;
}

export async function logoutCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return;
  }
  const tokenHash = hashToken(token);

  await prisma.session.deleteMany({ where: { tokenHash } });
  await clearAuthCookie();
}

export async function updatePasswordForCurrentAccount(
  accountId: number,
  nextPassword: string,
): Promise<void> {
  const passwordHash = await bcrypt.hash(nextPassword, 10);
  await prisma.account.update({
    where: { id: accountId },
    data: {
      passwordHash,
      forcePasswordChange: false,
    },
  });
}
