import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const topBar = readFileSync(join(dir, 'MobileTopBar.svelte'), 'utf8');
const layout = readFileSync(join(dir, '..', '..', '..', 'routes', 'p', '[projectId]', '+layout.svelte'), 'utf8');
const mobileBranch = layout.slice(layout.indexOf('{#if isMobile}'), layout.indexOf('{:else if onCanvasRoute}'));

describe('lo switch tela/chat sta in fondo, non nella top bar', () => {
  it('la top bar non disegna lo switch', () => {
    expect(topBar).not.toMatch(/mobile-view-canvas|mobile-view-chat|viewSwitch/);
  });

  it('il layout mobile monta lo switch dentro il main, dopo la chat', () => {
    const chat = mobileBranch.indexOf('<CanvasChatPanel');
    const viewSwitch = mobileBranch.indexOf('<MobileViewSwitch');
    expect(viewSwitch).toBeGreaterThan(chat);
  });
});

describe('promuovere dalla top bar mobile', () => {
  it('naviga alla pagina: su mobile nessuno monta il foglio', () => {
    expect(topBar).not.toMatch(/openSheet/);
    expect(topBar).toMatch(/<a[^>]*data-testid="mobile-promote"|<a[\s\S]*?href=\{`\/p\/\$\{projectId\}\$\{promotePath/);
  });
});
