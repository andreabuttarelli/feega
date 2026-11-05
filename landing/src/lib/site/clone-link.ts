import { APP_URL } from './links';

const WEB_SCHEME = /^https?:\/\//i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:(?!\d)/i;
const DOTTED_HOST = /^[^.]+(\.[^.]+)+$/;

export function cloneLink(raw: string): string | null {
  const typed = raw.trim();
  if (!WEB_SCHEME.test(typed) && ANY_SCHEME.test(typed)) {
    return null;
  }

  const full = WEB_SCHEME.test(typed) ? typed : `https://${typed}`;
  if (!URL.canParse(full)) {
    return null;
  }

  const url = new URL(full);
  if (!DOTTED_HOST.test(url.hostname)) {
    return null;
  }
  return `${APP_URL}/app?start_url=${encodeURIComponent(url.href)}`;
}
