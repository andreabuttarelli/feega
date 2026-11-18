import { describe, expect, it } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { Db } from '$lib/server/db/client';
import { firstRunFlags } from './first-run-flags';

const dbWith = (profile: Record<string, unknown> | null) =>
  ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: null }) }) }) })
  }) as unknown as Db;

const userWith = (metadata: Record<string, unknown>) => ({ id: 'u1', created_at: '2020-01-01T00:00:00Z', user_metadata: metadata }) as unknown as User;

describe('the viewer name in the first-run flags', () => {
  it('comes from the profile', async () => {
    const flags = await firstRunFlags(dbWith({ terms_version: null, name: 'Ada' }), userWith({ full_name: 'Other' }));

    expect(flags.name).toBe('Ada');
  });

  it('falls back to the auth metadata', async () => {
    const flags = await firstRunFlags(dbWith({ terms_version: null, name: null }), userWith({ name: 'Grace' }));

    expect(flags.name).toBe('Grace');
  });

  it('is null when nobody knows it', async () => {
    const flags = await firstRunFlags(dbWith(null), userWith({}));

    expect(flags.name).toBeNull();
  });
});
