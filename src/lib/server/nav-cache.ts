import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

// In-memory caches for same-instance SPA navigations (Vercel Fluid Compute reuses the isolate).
// These are the difference between 2–3s per click (getUser every time) and a
// cache hit that lets the page load run immediately after parent().

const USER_TTL_MS = 30_000;
const MAX_ENTRIES = 400;

type Timed<T> = { value: T; at: number };

const userByToken = new Map<string, Timed<User>>();

function prune<T>(map: Map<string, Timed<T>>, ttl: number) {
  if (map.size <= MAX_ENTRIES) return;
  const cutoff = Date.now() - ttl;
  for (const [k, v] of map) {
    if (v.at < cutoff) map.delete(k);
  }
  if (map.size > MAX_ENTRIES) {
    const extra = map.size - MAX_ENTRIES;
    let i = 0;
    for (const k of map.keys()) {
      map.delete(k);
      if (++i >= extra) break;
    }
  }
}

/**
 * Re-validate the JWT with Auth at most once per token per TTL.
 * getSession() is local (cookie → JWT); getUser() is a network round-trip to GoTrue and was
 * running on every in-app click. A revoked session still dies within USER_TTL_MS, and a token
 * refresh (new access_token) misses the cache immediately.
 */
export async function verifiedUser(
  supabase: SupabaseClient,
  session: Session
): Promise<User | null> {
  return cachedUser(session.access_token, session.expires_at ?? 0, () => supabase.auth.getUser());
}

export async function verifiedToken(supabase: SupabaseClient, token: string): Promise<User | null> {
  return cachedUser(token, expiryOf(token), () => supabase.auth.getUser(token));
}

function expiryOf(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : 0;
  } catch {
    return 0;
  }
}

type UserFetch = () => Promise<{ data: { user: User | null }; error: unknown }>;

async function cachedUser(token: string, expiresAtS: number, fetchUser: UserFetch): Promise<User | null> {
  if (!token) return null;
  const now = Date.now();
  const expMs = expiresAtS * 1000;
  if (expMs && expMs < now + 8_000) {
    userByToken.delete(token);
  } else {
    const hit = userByToken.get(token);
    if (hit && now - hit.at < USER_TTL_MS) return hit.value;
  }

  const {
    data: { user },
    error
  } = await fetchUser();
  if (error || !user) {
    userByToken.delete(token);
    return null;
  }
  userByToken.set(token, { value: user, at: now });
  prune(userByToken, USER_TTL_MS);
  return user;
}
