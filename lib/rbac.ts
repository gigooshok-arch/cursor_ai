import { AccessLevel } from "@prisma/client";
import { redirect } from "next/navigation";

import type { AuthAccount } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const accessWeight: Record<AccessLevel, number> = {
  HIDDEN: 0,
  READ: 1,
  WRITE: 2,
};

export function isAccessAllowed(
  actual: AccessLevel,
  required: AccessLevel,
): boolean {
  return accessWeight[actual] >= accessWeight[required];
}

export async function getSidebarTabsForRole(roleId: number) {
  const permissions = await prisma.permission.findMany({
    where: {
      roleId,
      tab: { isEnabled: true },
      access: { not: AccessLevel.HIDDEN },
    },
    include: { tab: true },
    orderBy: { tab: { order: "asc" } },
  });

  return permissions.map((item) => ({
    key: item.tab.key,
    title: item.tab.title,
    route: item.tab.route,
    access: item.access,
    sqlViewName: item.tab.sqlViewName,
  }));
}

export async function getTabAccessForRole(
  roleId: number,
  tabKey: string,
): Promise<AccessLevel> {
  const permission = await prisma.permission.findFirst({
    where: {
      roleId,
      tab: { key: tabKey, isEnabled: true },
    },
  });
  return permission?.access ?? AccessLevel.HIDDEN;
}

export async function requireTabAccess(
  account: AuthAccount,
  tabKey: string,
  required: AccessLevel,
): Promise<AccessLevel> {
  const access = await getTabAccessForRole(account.roleId, tabKey);
  if (!isAccessAllowed(access, required)) {
    redirect("/dashboard?forbidden=1");
  }
  return access;
}
