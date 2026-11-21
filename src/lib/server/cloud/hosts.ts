import { env } from '$env/dynamic/private';

const DEFAULT_ORIGIN_TEMPLATE = 'https://{sid}.s.feega.app';
const AUTH_PATH = '/__feega/auth';
const SID_PLACEHOLDER = '{sid}';

export function visitorOrigin(sid: string): string {
  return (env.SESSION_ORIGIN_TEMPLATE || DEFAULT_ORIGIN_TEMPLATE).replace(SID_PLACEHOLDER, sid);
}

export function visitorAuthUrl(sid: string, token: string, next: string): string {
  const query = new URLSearchParams({ token, next });

  return `${visitorOrigin(sid)}${AUTH_PATH}?${query}`;
}
