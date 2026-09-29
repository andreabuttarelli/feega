import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const layout = readFileSync(join(dir, '..', '..', '..', 'routes', 'p', '[projectId]', '+layout.svelte'), 'utf8');
const mobileBranch = layout.slice(layout.indexOf('{#if isMobile}'), layout.indexOf('{:else if onCanvasRoute}'));

describe('su mobile la chat resta montata anche quando si guarda la tela', () => {
  it('la chat mobile non sta dentro un blocco condizionale', () => {
    const chat = mobileBranch.indexOf('<CanvasChatPanel');
    expect(chat).toBeGreaterThan(-1);
    expect(mobileBranch.slice(0, chat).match(/\{#if /g)).toHaveLength(1);
  });

  it('niente barra in fondo: la vecchia tab bar non esiste più', () => {
    expect(layout).not.toMatch(/CanvasMobileTabs|CanvasMobileMore/);
  });
});
