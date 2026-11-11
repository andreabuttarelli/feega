import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.FEEGA_LOCAL_FILE = join(mkdtempSync(join(tmpdir(), 'feega-local-')), 'site.feega');
process.env.HOST = '127.0.0.1';
process.env.PUBLIC_APP_URL = 'http://127.0.0.1:5173';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const { createServiceRoleDb } = await import('./client');
const { createAdminClient } = await import('../supabase-admin');
const { localStore } = await import('../local/local-mode');

const USE = { path: 'test', why: 'test' } as never;

describe('local mode senza chiavi Supabase', () => {
  it('il client service-role è il database del file', () => {
    expect(createServiceRoleDb(USE)).toBe(localStore()!.db);
  });

  it('il client admin è il database del file', () => {
    expect(createAdminClient()).toBe(localStore()!.db);
  });
});
