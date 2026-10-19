import type { Session, User } from '@supabase/supabase-js';

const BEARER = /^Bearer\s+(\S+)$/i;

export type RequestSession = { session: Session | null; user: User | null };

const NO_SESSION: RequestSession = { session: null, user: null };

export function bearerTokenOf(request: Request): string | null {
  return BEARER.exec(request.headers.get('authorization') ?? '')?.[1] ?? null;
}

export async function bearerSession(token: string, verify: (token: string) => Promise<User | null>): Promise<RequestSession> {
  const user = await verify(token);
  if (!user) {
    return NO_SESSION;
  }
  return { session: { access_token: token, token_type: 'bearer', user } as Session, user };
}
