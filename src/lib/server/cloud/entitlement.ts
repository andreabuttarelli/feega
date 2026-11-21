import { env } from '$env/dynamic/private';

const SEPARATOR = ',';

export function cloudOrgIds(): ReadonlySet<string> {
  const listed = (env.CLOUD_ORG_IDS ?? '').split(SEPARATOR).map((id) => id.trim());

  return new Set(listed.filter(Boolean));
}

export function cloudEntitled(orgId: string): boolean {
  return cloudOrgIds().has(orgId);
}
