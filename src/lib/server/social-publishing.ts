import { createAnonDb, type Db } from '$lib/server/db/client';
import { SOCIAL_PUBLISHING_FLAG, SocialPublishing, socialPublishingOf } from '$lib/social-publishing';

const FLAG_TTL_MS = 30_000;

let cached: { value: SocialPublishing; at: number } | null = null;

async function readFlag(db: Db): Promise<SocialPublishing> {
  const { data } = await db.from('feature_flags').select('enabled').eq('key', SOCIAL_PUBLISHING_FLAG).maybeSingle();
  return socialPublishingOf(data?.enabled);
}

export async function socialPublishing(db: () => Db = createAnonDb, now = Date.now()): Promise<SocialPublishing> {
  if (cached && now - cached.at < FLAG_TTL_MS) {
    return cached.value;
  }
  const value = await Promise.resolve()
    .then(() => readFlag(db()))
    .catch(() => SocialPublishing.Off);
  cached = { value, at: now };
  return value;
}

export function forgetSocialPublishing(): void {
  cached = null;
}
