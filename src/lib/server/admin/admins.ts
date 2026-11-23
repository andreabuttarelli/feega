const SEPARATOR = ',';

export function isAdmin(email: string | null | undefined, allowlist: string | undefined): boolean {
  if (!email || !allowlist) {
    return false;
  }

  const admins = allowlist.split(SEPARATOR).map((entry) => entry.trim().toLowerCase());
  return admins.includes(email.toLowerCase());
}
