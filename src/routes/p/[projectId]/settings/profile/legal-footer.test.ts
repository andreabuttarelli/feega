import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const page = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');

describe('il profilo mostra il footer legale accanto alle impostazioni cookie', () => {
  it('monta LegalFooter, che porta anche Cookie settings', () => {
    expect(page).toMatch(/import LegalFooter from '\$lib\/components\/LegalFooter\.svelte'/);
    expect(page).toMatch(/<LegalFooter/);
  });

  it('la pagina conserva il suo pannello Privacy con openCookieSettings', () => {
    expect(page).toMatch(/import { openCookieSettings } from '\$lib\/consent'/);
    expect(page).toMatch(/onclick={openCookieSettings}/);
  });
});
