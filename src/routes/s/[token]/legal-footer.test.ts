import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const page = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');

describe('il visore condiviso mostra il footer legale', () => {
  it('monta LegalFooter', () => {
    expect(page).toMatch(/import LegalFooter from '\$lib\/components\/LegalFooter\.svelte'/);
    expect(page).toMatch(/<LegalFooter/);
  });
});
