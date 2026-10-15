import { pageAt } from '$lib/dashboard/pages';

export const LOGIN_PATH = '/login';
export const AUTH_CALLBACK_PATH = '/auth/callback';
export const TOOLS_PATH = '/app/tools';

const BUNDLED_PAGES = new Set([LOGIN_PATH, AUTH_CALLBACK_PATH, TOOLS_PATH]);

export function inBundle(pathname: string): boolean {
  return BUNDLED_PAGES.has(pathname) || pageAt(pathname) !== null;
}
