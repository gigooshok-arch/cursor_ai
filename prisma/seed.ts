import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { AccessLevel, GameObjectType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

function transliterate(input: string): string {
  const translitMap: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "kh",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };

  return input
    .toLowerCase()
    .split("")
    .map((char) => translitMap[char] ?? char)
    .join("")
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim();
}

function generateLoginFromFio(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => transliterate(part));

  const surname = parts[0] ?? "user";
  const initials = parts
    .slice(1)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2);
  return initials ? `${surname}_${initials}` : surname;
}

async function ensureEmployee(fullName: string, position: string, phone: string, isActivist: boolean) {
  const [surname = "", name = "", patronymic = ""] = fullName.trim().split(/\s+/);
  const existing = await prisma.employee.findFirst({ where: { fullName } });
  if (existing) {
    return existing;
  }
  return prisma.employee.create({
    data: {
      fullName,
      surname,
      name,
      patronymic: patronymic || null,
      position,
      phone,
      isActivist,
    },
  });
}

async function ensureParticipant(
  fullName: string,
  payload: {
    phone: string;
    age: number;
    school: string;
    className: string;
    note: string;
  },
) {
  const existing = await prisma.participant.findFirst({ where: { fullName } });
  if (existing) {
    return existing;
  }
  return prisma.participant.create({
    data: {
      fullName,
      phone: payload.phone,
      age: payload.age,
      school: payload.school,
      className: payload.className,
      note: payload.note,
    },
  });
}

async function ensureRelative(fullName: string, phone: string, note: string) {
  const existing = await prisma.relative.findFirst({ where: { fullName } });
  if (existing) {
    return existing;
  }
  return prisma.relative.create({
    data: {
      fullName,
      phone,
      note,
    },
  });
}

async function main() {
  await prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL;");

  const adminRole = await prisma.role.upsert({
    where: { code: "ADMIN" },
    update: { name: "Admin" },
    create: { code: "ADMIN", name: "Admin" },
  });
  const directorRole = await prisma.role.upsert({
    where: { code: "DIRECTOR" },
    update: { name: "Director" },
    create: { code: "DIRECTOR", name: "Director" },
  });
  const volunteerRole = await prisma.role.upsert({
    where: { code: "VOLUNTEER" },
    update: { name: "Volunteer" },
    create: { code: "VOLUNTEER", name: "Volunteer" },
  });

  const tabs = [
    { key: "dashboard", title: "Главная", route: "/dashboard", sqlViewName: "v_dashboard", order: 1 },
    { key: "people", title: "People", route: "/people", sqlViewName: "v_people", order: 2 },
    { key: "game_profiles", title: "Game Profiles", route: "/game-profiles", sqlViewName: "v_game_profiles", order: 3 },
    { key: "games", title: "Games", route: "/games", sqlViewName: "v_games", order: 4 },
    { key: "admin_accounts", title: "Admin Accounts", route: "/admin/accounts", sqlViewName: "v_admin_accounts", order: 5 },
    { key: "admin_roles", title: "Admin Roles", route: "/admin/roles", sqlViewName: "v_admin_roles", order: 6 },
    { key: "admin_tabs", title: "Admin Tabs", route: "/admin/tabs", sqlViewName: "v_admin_tabs", order: 7 },
  ] as const;

  for (const tab of tabs) {
    await prisma.navTab.upsert({
      where: { key: tab.key },
      update: {
        title: tab.title,
        route: tab.route,
        sqlViewName: tab.sqlViewName,
        order: tab.order,
        isEnabled: true,
      },
      create: {
        key: tab.key,
        title: tab.title,
        route: tab.route,
        sqlViewName: tab.sqlViewName,
        order: tab.order,
        isEnabled: true,
      },
    });
  }

  const dbTabs = await prisma.navTab.findMany();
  const permissionsConfig: Record<string, Partial<Record<string, AccessLevel>>> = {
    ADMIN: Object.fromEntries(dbTabs.map((tab) => [tab.key, AccessLevel.WRITE])),
    DIRECTOR: {
      dashboard: AccessLevel.READ,
      people: AccessLevel.WRITE,
      game_profiles: AccessLevel.WRITE,
      games: AccessLevel.WRITE,
      admin_accounts: AccessLevel.HIDDEN,
      admin_roles: AccessLevel.HIDDEN,
      admin_tabs: AccessLevel.HIDDEN,
    },
    VOLUNTEER: {
      dashboard: AccessLevel.READ,
      people: AccessLevel.READ,
      game_profiles: AccessLevel.READ,
      games: AccessLevel.READ,
      admin_accounts: AccessLevel.HIDDEN,
      admin_roles: AccessLevel.HIDDEN,
      admin_tabs: AccessLevel.HIDDEN,
    },
  };

  for (const role of [adminRole, directorRole, volunteerRole]) {
    for (const tab of dbTabs) {
      const roleConfig = permissionsConfig[role.code] ?? {};
      const access = roleConfig[tab.key] ?? AccessLevel.HIDDEN;

      await prisma.permission.upsert({
        where: {
          roleId_tabId: {
            roleId: role.id,
            tabId: tab.id,
          },
        },
        update: { access },
        create: {
          roleId: role.id,
          tabId: tab.id,
          access,
        },
      });
    }
  }

  for (const name of [
    "Quests",
    "Roleplays",
    "Sports",
    "Tabletop games",
  ]) {
    await prisma.activityType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const objects = [
    { name: "Серебряный меч", objectType: GameObjectType.GEAR, price: 120, parameters: "attack:+6" },
    { name: "Мешок монет", objectType: GameObjectType.ITEM, price: 60, parameters: "weight:1" },
    { name: "Медаль героя", objectType: GameObjectType.ACHIEVEMENT, price: 200, parameters: "rank:bronze" },
  ];
  for (const object of objects) {
    await prisma.gameObject.upsert({
      where: { name: object.name },
      update: object,
      create: object,
    });
  }

  const adminEmployee = await ensureEmployee(
    "Тымченко Александр Викторович",
    "Директор",
    "+79990000001",
    true,
  );
  const directorEmployee = await ensureEmployee(
    "Иванова Марина Сергеевна",
    "Координатор",
    "+79990000002",
    true,
  );
  const volunteerEmployee = await ensureEmployee(
    "Петров Николай Андреевич",
    "Волонтер",
    "+79990000003",
    true,
  );

  const accountSeeds = [
    { employee: adminEmployee, role: adminRole, password: "admin123" },
    { employee: directorEmployee, role: directorRole, password: "director123" },
    { employee: volunteerEmployee, role: volunteerRole, password: "volunteer123" },
  ];

  for (const seed of accountSeeds) {
    const login = generateLoginFromFio(seed.employee.fullName);
    const passwordHash = await bcrypt.hash(seed.password, 10);

    await prisma.account.upsert({
      where: { login },
      update: {
        employeeId: seed.employee.id,
        roleId: seed.role.id,
        passwordHash,
        isBlocked: false,
        forcePasswordChange: false,
      },
      create: {
        employeeId: seed.employee.id,
        roleId: seed.role.id,
        login,
        passwordHash,
        isBlocked: false,
        forcePasswordChange: false,
      },
    });
  }

  const participant1 = await ensureParticipant("Киреев Артем Викторович", {
    phone: "+79991112233",
    age: 15,
    school: "Школа №12",
    className: "8А",
    note: "Любит настольные ролевые игры",
  });
  const participant2 = await ensureParticipant("Романова Мария Сергеевна", {
    phone: "+79991112234",
    age: 14,
    school: "Лицей №3",
    className: "7Б",
    note: "Участвует в творческих кружках",
  });

  const relative1 = await ensureRelative(
    "Киреев Виктор Алексеевич",
    "+79992223344",
    "Отец",
  );
  const relative2 = await ensureRelative(
    "Романова Елена Петровна",
    "+79992223345",
    "Мать",
  );

  await prisma.relationLink.upsert({
    where: {
      participantId_relativeId_relationType: {
        participantId: participant1.id,
        relativeId: relative1.id,
        relationType: "отец",
      },
    },
    update: {},
    create: {
      participantId: participant1.id,
      relativeId: relative1.id,
      relationType: "отец",
    },
  });
  await prisma.relationLink.upsert({
    where: {
      participantId_relativeId_relationType: {
        participantId: participant2.id,
        relativeId: relative2.id,
        relationType: "мать",
      },
    },
    update: {},
    create: {
      participantId: participant2.id,
      relativeId: relative2.id,
      relationType: "мать",
    },
  });

  await prisma.gameProfile.upsert({
    where: { participantId: participant1.id },
    update: { heroName: "Арден Странник", level: 3, gold: 40 },
    create: {
      participantId: participant1.id,
      heroName: "Арден Странник",
      level: 3,
      loot: 2,
      achievements: 1,
      gold: 40,
    },
  });
  await prisma.gameProfile.upsert({
    where: { participantId: participant2.id },
    update: { heroName: "Лира Светлая", level: 2, gold: 25 },
    create: {
      participantId: participant2.id,
      heroName: "Лира Светлая",
      level: 2,
      loot: 1,
      achievements: 0,
      gold: 25,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
