export type ProfileEntityType = "participant" | "employee" | "relative";

export type ParsedProfileSlug = {
  entityType: ProfileEntityType;
  id: number;
};

const allowedTypes = new Set<ProfileEntityType>([
  "participant",
  "employee",
  "relative",
]);

export function buildProfileSlug(entityType: ProfileEntityType, id: number): string {
  return `${entityType}-${id}`;
}

export function buildProfileHref(entityType: ProfileEntityType, id: number): string {
  return `/profile/${buildProfileSlug(entityType, id)}`;
}

export function parseProfileSlug(slug: string): ParsedProfileSlug | null {
  const match = slug.match(/^([a-z_]+)-(\d+)$/);
  if (!match) {
    return null;
  }
  const entityType = match[1] as ProfileEntityType;
  const id = Number(match[2]);
  if (!allowedTypes.has(entityType) || !Number.isInteger(id) || id <= 0) {
    return null;
  }
  return { entityType, id };
}
