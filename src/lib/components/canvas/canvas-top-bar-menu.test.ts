import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * IL MENU BURGER DELLA TOP BAR: home, scorciatoie, impostazioni, fatturazione, esci — una
 * tabella sola, non un `if` per voce. La barra in cima al progetto/tela non aveva un punto
 * d'uscita esplicito verso il resto del prodotto: solo lo switcher di progetto/tela e la chat.
 */
const dir = dirname(fileURLToPath(import.meta.url));
const top = readFileSync(join(dir, 'CanvasTopBar.svelte'), 'utf8');

describe('il menu burger della top bar', () => {
  it('vive in un file suo, non scritto dentro CanvasTopBar', () => {
    expect(top).toMatch(/<CanvasMenu/);
  });

  it('la top bar non elenca più le voci a mano: le prende dalla tabella', () => {
    const menu = readFileSync(join(dir, 'CanvasMenu.svelte'), 'utf8');
    expect(menu).toMatch(/CANVAS_MENU_ITEMS/);
  });
});

describe('la tabella delle voci del menu', () => {
  const menu = readFileSync(join(dir, 'CanvasMenu.svelte'), 'utf8');

  it('elenca home, scorciatoie, impostazioni, fatturazione ed esci', () => {
    expect(menu).toMatch(/home/);
    expect(menu).toMatch(/shortcuts/);
    expect(menu).toMatch(/settings/);
    expect(menu).toMatch(/billing/);
    expect(menu).toMatch(/logout/);
  });

  it('home porta alla home del progetto, mai a /app che è deprecata', () => {
    expect(menu).toMatch(/\/p\/\$\{projectId\}/);
    expect(menu).not.toMatch(/['"`]\/app['"`]/);
  });

  it('segnala un contenuto apre il modulo DSA/DMCA', () => {
    expect(menu).toMatch(/id: 'report'.*href: REPORT_PATH/);
  });

  it('esci invia il POST a /auth/signout, lo stesso della pagina profilo', () => {
    expect(menu).toMatch(/\/auth\/signout/);
  });

  it('impostazioni e fatturazione passano da openSheet, non da una navigazione piena', () => {
    expect(menu).toMatch(/openSheet/);
  });

  it('le scorciatoie restano quelle di CANVAS_SHORTCUTS, non riscritte', () => {
    expect(menu).toMatch(/CANVAS_SHORTCUTS/);
  });

  it('ha un nome accessibile: un\'icona sola non si legge', () => {
    expect(menu).toMatch(/aria-label/);
  });

  it('ogni voce porta un gruppo esplicito (navigate, help, account)', () => {
    expect(menu).toMatch(/group:\s*['"`]navigate['"`]/);
    expect(menu).toMatch(/group:\s*['"`]help['"`]/);
    expect(menu).toMatch(/group:\s*['"`]account['"`]/);
  });

  it('la fatturazione mostra il saldo crediti nel menu', () => {
    expect(menu).toMatch(/creditBalance/);
    expect(menu).toMatch(/CreditAmount/);
  });

  it('esci è in tono muto/danger, non uguale alle altre voci', () => {
    expect(menu).toMatch(/variant="destructive"|is-danger/);
  });

  it('riceve profilo e org dai dati di pagina per l\'header', () => {
    expect(menu).toMatch(/profile/);
    expect(menu).toMatch(/org/);
  });

  it('mostra nome e email nell\'header del menu', () => {
    expect(menu).toMatch(/profile\.name/);
    expect(menu).toMatch(/profile\.email/);
  });
});

describe('CanvasTopBar passa profilo, org e saldo al menu', () => {
  it('inoltra profile, org e creditBalance a CanvasMenu', () => {
    expect(top).toMatch(/<CanvasMenu[\s\S]*?profile[\s\S]*?\/>/);
    expect(top).toMatch(/<CanvasMenu[\s\S]*?org[\s\S]*?\/>/);
    expect(top).toMatch(/<CanvasMenu[\s\S]*?creditBalance[\s\S]*?\/>/);
  });
});
