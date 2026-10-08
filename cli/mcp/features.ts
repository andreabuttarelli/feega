import { appUrl } from '../lib/config.ts';

export enum SocialPublishing {
  On = 'on',
  Off = 'off',
}

const FEATURES_PATH = '/api/v1/features';
const FEATURES_TIMEOUT_MS = 3_000;
const FEATURES_TTL_MS = 30_000;

let cached: { value: SocialPublishing; until: number } | null = null;

async function fetchSocialPublishing(): Promise<SocialPublishing> {
  const res = await fetch(`${appUrl()}${FEATURES_PATH}`, { signal: AbortSignal.timeout(FEATURES_TIMEOUT_MS) });
  if (!res.ok) {
    return SocialPublishing.Off;
  }
  const body = (await res.json()) as { social_publishing?: unknown };
  return body.social_publishing === true ? SocialPublishing.On : SocialPublishing.Off;
}

export async function socialPublishing(now = Date.now()): Promise<SocialPublishing> {
  if (cached && now < cached.until) {
    return cached.value;
  }
  const value = await fetchSocialPublishing().catch(() => SocialPublishing.Off);
  cached = { value, until: now + FEATURES_TTL_MS };
  return value;
}

export function assumeSocialPublishing(value: SocialPublishing): void {
  cached = { value, until: Number.POSITIVE_INFINITY };
}
