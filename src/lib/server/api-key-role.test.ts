import { describe, expect, it, vi } from 'vitest';
import { createTestSupabase } from '$lib/testkit/supabase';

const RAW_KEY = 'feega_live_rolecheck';

async function callWithKey(method: string, role: string | null, scopes: string[]) {
  vi.resetModules();
  vi.doMock('$env/dynamic/private', () => ({ env: { SUPABASE_SERVICE_ROLE_KEY: 'service-role' } }));
  const rows: Record<string, unknown>[] = [];
  const members = role ? [{ org_id: 'org-1', user_id: 'user-1', role }] : [];
  vi.doMock('@supabase/supabase-js', () => ({
    createClient: () => createTestSupabase({ api_keys: rows, orgs_members: members }).client
  }));

  const { authenticate, hashApiKey } = await import('./cli-auth');
  rows.push({ id: 'key-1', user_id: 'user-1', org_id: 'org-1', name: 'k', key_hash: await hashApiKey(RAW_KEY), scopes });

  return authenticate(new Request('https://x/api/v1/brands/demo', { method, headers: { authorization: `Bearer ${RAW_KEY}` } }));
}

describe('a write key never exceeds its owner current role', () => {
  it.each(['owner', 'admin', 'member'])('a %s write key writes', async (role) => {
    const res = await callWithKey('POST', role, ['read', 'write']);

    expect(res.error).toBeUndefined();
  });

  it('a member demoted to viewer keeps reading but can no longer write', async () => {
    const read = await callWithKey('GET', 'viewer', ['read', 'write']);
    const write = await callWithKey('POST', 'viewer', ['read', 'write']);

    expect(read.error).toBeUndefined();
    expect(read.apiKey?.scopes).toEqual(['read']);
    expect(write.error?.status).toBe(403);
  });

  it('a member removed from the org is locked out, even to read', async () => {
    const res = await callWithKey('GET', null, ['read', 'write']);

    expect(res.error?.status).toBe(401);
  });
});
