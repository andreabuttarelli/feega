import { env } from '$env/dynamic/public';

export function devSelfOrigin(): string | null {
  const own = env.PUBLIC_APP_URL;
  return process.env.NODE_ENV !== 'production' && own && URL.canParse(own) ? new URL(own).origin : null;
}
