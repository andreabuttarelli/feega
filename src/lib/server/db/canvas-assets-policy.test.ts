import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = join(process.cwd(), 'supabase/migrations');
const POLICIES = ['canvas-assets read own org', 'canvas-assets insert own org', 'canvas-assets delete own org'];

function lastDefinition(policy: string): string {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  const pattern = new RegExp(`create policy\\s+"${policy}"[\\s\\S]*?;`, 'gi');
  const found = files.flatMap((f) => readFileSync(join(MIGRATIONS, f), 'utf8').match(pattern) ?? []);
  return found.at(-1) ?? '';
}

describe('canvas-assets policies', () => {
  it.each(POLICIES)('"%s" compares the org folder as text: one object under a non-uuid folder must not break every list of the bucket', (policy) => {
    const sql = lastDefinition(policy);

    expect(sql).not.toBe('');
    expect(sql).not.toMatch(/foldername\(name\)\)\[1\]\)?::uuid/i);
  });
});
