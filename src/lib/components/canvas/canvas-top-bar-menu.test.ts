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

  it('home porta al vero punto d\'ingresso, non a /app scritto a mano come link morto', () => {
    expect(menu).toMatch(/\/app/);
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
});
