import { describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-figma' } }));

const { figmaTokenStore } = await import('./token-store');
const { sealSecret } = await import('$lib/server/secrets/seal');

const TOKEN = 'figd_secret_token';

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

describe('the Figma token of a user is stored sealed', () => {
  it('saves only the sealed text', async () => {
    const { db, calls } = fakeDb({});

    await figmaTokenStore(db, 'u1').save(TOKEN);

    const row = calls.find((c) => c.op === 'upsert')?.args[0] as { user_id: string; token_sealed: string };
    expect(row.user_id).toBe('u1');
    expect(row.token_sealed).not.toContain('figd');
  });

  it('reads the token back opened', async () => {
    const { db, calls } = fakeDb({ data: { token_sealed: sealSecret('feega:figma-token', TOKEN) } });

    expect(await figmaTokenStore(db, 'u1').read()).toBe(TOKEN);
    expect(calls).toContainEqual({ op: 'eq', args: ['user_id', 'u1'] });
  });

  it('a table not migrated yet reads as no token', async () => {
    const { db } = fakeDb({ error: { code: '42P01' } });

    expect(await figmaTokenStore(db, 'u1').read()).toBeNull();
  });

  it('a seal that does not open reads as no token', async () => {
    const { db } = fakeDb({ data: { token_sealed: 'garbage' } });

    expect(await figmaTokenStore(db, 'u1').read()).toBeNull();
  });

  it('removes the row of the user', async () => {
    const { db, calls } = fakeDb({});

    await figmaTokenStore(db, 'u1').remove();

    expect(calls).toContainEqual({ op: 'eq', args: ['user_id', 'u1'] });
  });
});
