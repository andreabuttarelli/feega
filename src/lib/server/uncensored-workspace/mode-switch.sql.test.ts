import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UncensoredLock } from '$lib/uncensored-lock';
import { NOT_SHAREABLE, OUTPUTS_PRESENT } from './mode-switch';

const MIGRATION = 'supabase/migrations/20261003100000_uncensored_mode_switch.sql';
const sql = readFileSync(MIGRATION, 'utf8');

function codesIn(pattern: RegExp): Set<string> {
  return new Set([...sql.matchAll(pattern)].map((m) => m[1]));
}

describe('the mode trigger refuses with the same codes as the app table', () => {
  it('raises every refusal the app can give, and no other', () => {
    const app = new Set([...Object.values(UncensoredLock).filter((l) => l !== UncensoredLock.Open), NOT_SHAREABLE, OUTPUTS_PRESENT]);
    const db = new Set([...codesIn(/then '([a-z_]+)'/g), ...codesIn(/raise exception '([a-z_]+)'/g)]);

    expect(db).toEqual(app);
  });

  it('refuses a switch to uncensored when no user is behind the update', () => {
    expect(sql).toMatch(/p_user_id is null or not exists/);
  });
});
