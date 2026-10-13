import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const page = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');

describe('la login offre Google e GitHub', () => {
  it('un form punta a ?/google', () => {
    expect(page).toMatch(/action="\?\/google"/);
  });

  it('GitHub resta', () => {
    expect(page).toMatch(/action="\?\/github"/);
  });
});
