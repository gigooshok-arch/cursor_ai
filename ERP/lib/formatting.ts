export function formatDateRu(value: Date | string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTimeRu(value: Date | string | null | undefined): string {
  if (!value) {
    return "—";
  }
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizePhoneDigits(value: string): string {
  let digits = onlyDigits(value);
  if (!digits) {
    return "";
  }

  if (digits.length === 10) {
    digits = `7${digits}`;
  } else if (digits.length === 11 && digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  }
  return digits.slice(0, 11);
}

export function maskPhoneRu(value: string): string {
  const digits = normalizePhoneDigits(value);
  if (!digits) {
    return "";
  }

  const country = "+7";
  const code = digits.slice(1, 4);
  const p1 = digits.slice(4, 7);
  const p2 = digits.slice(7, 9);
  const p3 = digits.slice(9, 11);

  if (digits.length <= 1) {
    return country;
  }
  if (digits.length <= 4) {
    return `${country} (${code}`;
  }
  if (digits.length <= 7) {
    return `${country} (${code}) ${p1}`;
  }
  if (digits.length <= 9) {
    return `${country} (${code}) ${p1}-${p2}`;
  }
  return `${country} (${code}) ${p1}-${p2}-${p3}`;
}

export function normalizePhoneRu(value: string | null | undefined): string | null {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return null;
  }
  const digits = raw.replace(/\D/g, "");
  let normalizedDigits = digits;
  if (normalizedDigits.length === 10) {
    normalizedDigits = `7${normalizedDigits}`;
  } else if (normalizedDigits.length === 11 && normalizedDigits.startsWith("8")) {
    normalizedDigits = `7${normalizedDigits.slice(1)}`;
  }
  if (normalizedDigits.length !== 11 || !normalizedDigits.startsWith("7")) {
    return null;
  }
  return maskPhoneRu(normalizedDigits);
}
