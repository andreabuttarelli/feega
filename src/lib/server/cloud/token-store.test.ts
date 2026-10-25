import { describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-cloud' } }));

const { cloudTokenStore } = await import('./token-store');
const { CloudProvider } = await import('./cloud');

const TOKENS = { accessToken: 'ya29.secret', refreshToken: '1//refresh', expiresAt: 123 };

function fakeDb(answer: { data?: unknown; error?: { code?: string } | null }) {
  const calls: { op: string; args: unknown[] }[] = [];
  const chain: Record<string, unknown> = {};
  for (const op of ['select', 'eq', 'upsert', 'delete', 'maybeSingle']) {
    chain[op] = vi.fn((...args: unknown[]) => {
      calls.push({ op, args });
      return chain;
    });
  }
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: answer.data ?? null, error: answer.error ?? null });
  return { db: { from: vi.fn(() => chain) } as unknown as Db, calls };
}

describe('cloud tokens are stored sealed, per user and provider', () => {
  it('saves only sealed text under the provider', async () => {
    const { db, calls } = fakeDb({});

    await cloudTokenStore(db, 'u1').save(CloudProvider.Drive, TOKENS);

    const row = calls.find((c) => c.op === 'upsert')?.args[0] as { user_id: string; provider: string; tokens_sealed: string };
    expect(row).toMatchObject({ user_id: 'u1', provider: 'google_drive' });
    expect(row.tokens_sealed).not.toContain('ya29');
    expect(calls.find((c) => c.op === 'upsert')?.args[1]).toEqual({ onConflict: 'user_id,provider' });
  });

  it('reads them back opened', async () => {
    const saved = fakeDb({});
    await cloudTokenStore(saved.db, 'u1').save(CloudProvider.Dropbox, TOKENS);
    const sealed = (saved.calls.find((c) => c.op === 'upsert')?.args[0] as { tokens_sealed: string }).tokens_sealed;
    const { db, calls } = fakeDb({ data: { tokens_sealed: sealed } });

    expect(await cloudTokenStore(db, 'u1').read(CloudProvider.Dropbox)).toEqual(TOKENS);
    expect(calls).toContainEqual({ op: 'eq', args: ['provider', 'dropbox'] });
  });

  it('a table not migrated yet reads as not connected', async () => {
    const { db } = fakeDb({ error: { code: '42P01' } });

    expect(await cloudTokenStore(db, 'u1').read(CloudProvider.Drive)).toBeNull();
  });

  it('a seal that does not open reads as not connected', async () => {
    const { db } = fakeDb({ data: { tokens_sealed: 'garbage' } });

    expect(await cloudTokenStore(db, 'u1').read(CloudProvider.Drive)).toBeNull();
  });
});
