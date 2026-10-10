import { describe, it, expect, vi } from 'vitest';
import { TourState } from '$lib/onboarding/tour';

vi.mock('$lib/server/feature-flags', () => ({ isPlanGoEnabled: () => false }));
vi.mock('$lib/server/seline', () => ({ selineSetUser: vi.fn() }));
vi.mock('$lib/server/internal-users', () => ({ isInternalEmail: () => false }));
vi.mock('$lib/analytics', () => ({ trackingAllowed: () => true }));
vi.mock('$lib/server/social-publishing', () => ({ socialPublishing: async () => 'off' }));

const { load } = await import('./+layout.server');

const NEW_USER = '2026-10-12T09:00:00Z';
const OLD_USER = '2026-01-01T09:00:00Z';
const NO_COLUMN = { code: '42703', message: 'column profiles.onboarding_seen_at does not exist' };

type Profile = { onboarding_seen_at?: string | null; error?: unknown };

function event(user: { id: string; created_at: string } | null, profile: Profile) {
  const answer = (columns: string) =>
    columns.includes('onboarding_seen_at') && profile.error
      ? { data: null, error: profile.error }
      : { data: { terms_version: null, onboarding_seen_at: profile.onboarding_seen_at ?? null }, error: null };

  return {
    request: new Request('https://feega.test/app'),
    url: new URL('https://feega.test/app'),
    locals: {
      safeGetSession: async () => ({ session: user ? { user } : null, user }),
      db: async () => ({
        from: () => ({
          select: (columns: string) => ({ eq: () => ({ maybeSingle: async () => answer(columns) }) })
        })
      })
    }
  };
}

const tourOf = async (e: unknown) => ((await (load as (e: unknown) => Promise<{ tour: TourState }>)(e)).tour);

describe('il tour al primo accesso', () => {
  it('si apre al primo accesso di un utente nuovo', async () => {
    expect(await tourOf(event({ id: 'u1', created_at: NEW_USER }, { onboarding_seen_at: null }))).toBe(TourState.Due);
  });

  it('non si riapre al secondo accesso', async () => {
    expect(await tourOf(event({ id: 'u1', created_at: NEW_USER }, { onboarding_seen_at: '2026-10-12T10:00:00Z' }))).toBe(TourState.Seen);
  });

  it('chi era già iscritto non lo vede da solo', async () => {
    expect(await tourOf(event({ id: 'u1', created_at: OLD_USER }, { onboarding_seen_at: null }))).toBe(TourState.Seen);
  });

  it('senza colonna decide il browser', async () => {
    expect(await tourOf(event({ id: 'u1', created_at: NEW_USER }, { error: NO_COLUMN }))).toBe(TourState.Unknown);
  });

  it('senza sessione niente tour', async () => {
    expect(await tourOf(event(null, {}))).toBe(TourState.Seen);
  });
});
