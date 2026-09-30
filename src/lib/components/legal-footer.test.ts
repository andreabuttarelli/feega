import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FOOTER_LEGAL_LINKS } from '$lib/legal-links';

const component = readFileSync(fileURLToPath(new URL('./LegalFooter.svelte', import.meta.url)), 'utf8');

describe('il footer legale condiviso', () => {
  it('itera la tabella ordinata, non un elenco scritto a mano', () => {
    expect(component).toMatch(/FOOTER_LEGAL_LINKS/);
    expect(component).toMatch(/legalHref\(key\)/);
  });

  it('apre ogni voce in una scheda nuova senza esporre l’opener', () => {
    expect(component).toMatch(/target="_blank" rel="noopener"/);
  });

  it('la tabella copre tutte le nove pagine richieste', () => {
    expect(FOOTER_LEGAL_LINKS).toHaveLength(9);
    expect(new Set(FOOTER_LEGAL_LINKS).size).toBe(9);
  });
});
