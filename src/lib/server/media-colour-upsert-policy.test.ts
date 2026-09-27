import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const MIGRATION = readFileSync(
  new URL('../../../supabase/migrations/20260927190000_media_colour_upsert.sql', import.meta.url),
  'utf8'
);

const ORG_FOLDER = /\(storage\.foldername\(name\)\)\[2\][\s\S]*auth_org_ids\(\)/;

describe('uno swatch colore si riscrive con upsert', () => {
  it('ha una policy SELECT sulla cartella colours della propria org', () => {
    expect(MIGRATION).toMatch(/create policy "media select own colour" on storage\.objects\s+for select/);
    expect(MIGRATION).toMatch(ORG_FOLDER);
  });

  it('ha una policy UPDATE sulla stessa cartella, con using e with check', () => {
    expect(MIGRATION).toMatch(/create policy "media update own colour" on storage\.objects\s+for update/);
    expect(MIGRATION).toMatch(/for update[\s\S]*using[\s\S]*with check/);
  });
});
