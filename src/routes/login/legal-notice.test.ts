import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { legalHref } from '$lib/legal-links';

const page = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');
const NOTICE_KEYS = ['terms', 'acceptableUse', 'privacy', 'cookies'] as const;

describe('la pagina di accesso mostra la notizia legale', () => {
  it('usa la chiave i18n della notizia', () => {
    expect(page).toMatch(/login\.legal\.notice/);
  });

  it('ogni link della notizia passa dalla tabella condivisa, non da un URL scritto a mano', () => {
    for (const key of NOTICE_KEYS) {
      expect(page).toMatch(new RegExp(`legalHref\\('${key}'\\)`));
    }
  });

  it('i link aprono in una scheda nuova senza esporre l’opener', () => {
    expect(page).toMatch(/target="_blank" rel="noopener"/);
  });

  it('la notizia si nasconde nel modulo di recupero password', () => {
    const noticeBlock = page.slice(page.indexOf('legal-notice') - 60, page.indexOf('legal-notice'));
    expect(noticeBlock).toMatch(/mode !== 'forgot'/);
  });
});

describe('la pagina di accesso tiene solo i link dell avviso', () => {
  it('non monta LegalFooter', () => {
    expect(page).not.toMatch(/LegalFooter/);
  });
});

describe('le quattro pagine legali richieste sono raggiungibili', () => {
  it('terms, acceptable-use, privacy, cookies', () => {
    expect(legalHref('terms')).toBe('https://feega.app/terms');
    expect(legalHref('acceptableUse')).toBe('https://feega.app/acceptable-use');
    expect(legalHref('privacy')).toBe('https://feega.app/privacy');
    expect(legalHref('cookies')).toBe('https://feega.app/cookies');
  });
});
