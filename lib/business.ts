import { GameObjectType, PrismaClient } from "@prisma/client";

import { generateLoginFromFio } from "@/lib/transliteration";

export function goldFromPrice(price: number, quantity: number): number {
  return Math.floor(price / 2) * Math.max(1, quantity);
}

export function splitFullName(fullName: string): {
  surname: string;
  name: string;
  patronymic: string | null;
} {
  const [surname = "", name = "", patronymic = ""] = fullName
    .trim()
    .split(/\s+/);

  return {
    surname,
    name,
    patronymic: patronymic || null,
  };
}

export function getProfileCountersByObjectType(
  objectType: GameObjectType,
  quantity: number,
): { loot: number; achievements: number } {
  if (objectType === GameObjectType.ACHIEVEMENT) {
    return { loot: 0, achievements: quantity };
  }
  return { loot: quantity, achievements: 0 };
}

export async function generateUniqueLogin(
  prisma: PrismaClient,
  fullName: string,
): Promise<string> {
  const base = generateLoginFromFio(fullName);
  let candidate = base;
  let index = 1;

  while (true) {
    const exists = await prisma.account.findUnique({
      where: { login: candidate },
      select: { id: true },
    });
    if (!exists) {
      return candidate;
    }
    index += 1;
    candidate = `${base}${index}`;
  }
}
