import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const page = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');

describe('le impostazioni mostrano i link legali', () => {
  it('usa il footer legale condiviso, non un elenco scritto a mano', () => {
    expect(page).toMatch(/import LegalFooter from '\$lib\/components\/LegalFooter\.svelte'/);
    expect(page).toMatch(/<LegalFooter/);
  });
});
