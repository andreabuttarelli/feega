export const DASHBOARD_PATH = '/app';

const REACHABLE_PATHS: readonly string[] = [DASHBOARD_PATH, '/app/settings/profile', '/app/settings/billing', '/app/admin/stats'];

export function isReachable(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return REACHABLE_PATHS.includes(path);
}
