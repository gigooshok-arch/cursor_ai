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

export function transliterate(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((char) => translitMap[char] ?? char)
    .join("")
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim();
}

export function generateLoginFromFio(fullName: string): string {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => transliterate(part));

  if (parts.length === 0) {
    return "user";
  }

  const surname = parts[0] || "user";
  const initials = parts
    .slice(1)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2);

  if (!initials) {
    return surname;
  }

  return `${surname}_${initials}`.replace(/_+/g, "_");
}
