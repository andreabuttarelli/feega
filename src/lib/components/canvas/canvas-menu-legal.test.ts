import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FOOTER_LEGAL_LINKS } from '$lib/legal-links';

const component = readFileSync(fileURLToPath(new URL('./CanvasMenu.svelte', import.meta.url)), 'utf8');

describe('il sottomenu Legal nel menu hamburger', () => {
  it("c'è una voce nel gruppo help che apre il sottomenu legale", () => {
    expect(component).toMatch(/id: 'legal', group: 'help'/);
  });

  it('itera la tabella condivisa, non un elenco scritto a mano', () => {
    expect(component).toMatch(/FOOTER_LEGAL_LINKS as key/);
    expect(component).toMatch(/legalHref\(key\)/);
  });

  it('ogni voce apre in una scheda nuova senza esporre l’opener', () => {
    expect(component).toMatch(/target="_blank" rel="noopener"/);
  });

  it('la tabella copre tutte le nove pagine legali', () => {
    expect(FOOTER_LEGAL_LINKS).toHaveLength(9);
  });
});
