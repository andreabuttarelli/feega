import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const MIGRATION = readFileSync(
  new URL('../../../../supabase/migrations/20261002160000_content_reports.sql', import.meta.url),
  'utf8'
);

describe('content_reports schema', () => {
  it.each(['content_reports', 'account_strikes'])('%s is behind RLS with no policy: no JWT reads it, reporters included', (table) => {
    expect(MIGRATION).toContain(`alter table public.${table} enable row level security`);
    expect(MIGRATION).toContain(`revoke all on public.${table} from anon, authenticated`);
  });

  it('declares no policy that would open a row to a session', () => {
    expect(MIGRATION).not.toMatch(/create policy/i);
  });
});
