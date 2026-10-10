import { env } from '$env/dynamic/public';

export function devSelfOrigin(): string | null {
  const own = env.PUBLIC_APP_URL;
  return import.meta.env.DEV && own && URL.canParse(own) ? new URL(own).origin : null;
}
