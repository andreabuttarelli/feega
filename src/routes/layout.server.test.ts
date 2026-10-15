import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/feature-flags', () => ({ isPlanGoEnabled: () => false }));
vi.mock('$lib/server/seline', () => ({ selineSetUser: vi.fn() }));
vi.mock('$lib/server/internal-users', () => ({ isInternalEmail: () => false }));
vi.mock('$lib/analytics', () => ({ trackingAllowed: () => true }));
vi.mock('$lib/server/social-publishing', () => ({ socialPublishing: async () => 'off' }));

import { load } from './+layout.server';
import { CURRENT_TERMS_VERSION } from '$lib/legal-links';

function event(user: { id: string } | null, termsVersion: string | null) {
  return {
    request: new Request('https://feega.test/'),
    url: new URL('https://feega.test/'),
    untrack: <T>(fn: () => T): T => fn(),
    locals: {
      safeGetSession: async () => ({ session: user ? { user } : null, user }),
      db: async () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: user ? { terms_version: termsVersion } : null })
            })
          })
        })
      })
    }
  };
}

beforeEach(() => vi.clearAllMocks());

describe('avviso di termini aggiornati nel layout radice', () => {
  it('nessun avviso senza sessione', async () => {
    const result = await (load as (e: unknown) => Promise<{ termsNoticeVersion: string | null }>)(
      event(null, null)
    );
    expect(result.termsNoticeVersion).toBeNull();
  });

  it('nessun avviso quando il profilo è già alla versione corrente', async () => {
    const result = await (load as (e: unknown) => Promise<{ termsNoticeVersion: string | null }>)(
      event({ id: 'u1' }, CURRENT_TERMS_VERSION)
    );
    expect(result.termsNoticeVersion).toBeNull();
  });

  it('avviso quando il profilo è a una versione precedente', async () => {
    const result = await (load as (e: unknown) => Promise<{ termsNoticeVersion: string | null }>)(
      event({ id: 'u1' }, '2020-01-01')
    );
    expect(result.termsNoticeVersion).toBe(CURRENT_TERMS_VERSION);
  });
});

describe('il layout radice non rallenta ogni navigazione', () => {
  function trackedEvent() {
    const tracked: string[] = [];
    let untracked = false;
    let inFlight = 0;
    let peak = 0;
    const url = new Proxy(new URL('https://feega.test/app'), {
      get(target, key) {
        if (!untracked) {
          tracked.push(String(key));
        }
        return Reflect.get(target, key);
      }
    });
    const slowRow = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
      return { data: { terms_version: CURRENT_TERMS_VERSION, onboarding_seen_at: '2026-01-01' } };
    };
    const user = { id: 'u1', created_at: '2026-01-01' };
    const e = {
      url,
      untrack: <T>(fn: () => T): T => {
        untracked = true;
        try {
          return fn();
        } finally {
          untracked = false;
        }
      },
      locals: {
        safeGetSession: async () => ({ session: { user }, user }),
        db: async () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: slowRow }) }) }) })
      }
    };
    return { e, tracked, peak: () => peak };
  }

  it('non dipende dall’URL, così una navigazione client non lo riesegue', async () => {
    const { e, tracked } = trackedEvent();
    await (load as (e: unknown) => Promise<unknown>)(e);
    expect(tracked).toEqual([]);
  });

  it('le letture del profilo partono insieme, non in serie', async () => {
    const { e, peak } = trackedEvent();
    await (load as (e: unknown) => Promise<unknown>)(e);
    expect(peak()).toBeGreaterThan(1);
  });
});
