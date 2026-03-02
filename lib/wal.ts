import { prisma } from "@/lib/prisma";

let walEnabled = false;

export async function ensureSQLiteWalMode(): Promise<void> {
  if (walEnabled) {
    return;
  }

  await prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL;");
  walEnabled = true;
}
