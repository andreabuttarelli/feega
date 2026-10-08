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
