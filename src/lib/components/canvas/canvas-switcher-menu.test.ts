import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));
const sources = {
  desktop: readFileSync(join(dir, 'CanvasTopBar.svelte'), 'utf8'),
  mobile: readFileSync(join(dir, 'CanvasMobileSwitcher.svelte'), 'utf8')
};

describe.each(Object.entries(sources))('lo switcher %s', (_name, source) => {
  it('ordina e filtra i progetti con switcher-list, non a mano', () => {
    expect(source).toMatch(/from '\$lib\/canvas\/switcher-list'/);
    expect(source).toMatch(/recentFirst\(/);
    expect(source).toMatch(/matching\(/);
  });

  it('elimina la tela solo dal menu ⋯, dopo conferma', () => {
    expect(source).toMatch(/data-testid="canvas-more"/);
    expect(source).toMatch(/data-testid="canvas-delete"[\s\S]*?onSelect={askDeleteCurrent}/);
    expect(source).toMatch(/<ConfirmDialog/);
  });

  it('mostra il brand del progetto quando c\'è', () => {
    expect(source).toMatch(/{#if brandName}/);
  });

  it('il nome lungo si tronca e resta leggibile nel tooltip', () => {
    expect(source).toMatch(/title={canvas\.name}/);
    expect(source).toMatch(/title={project\.name}/);
  });

  it('nessun angolo arrotondato', () => {
    expect(source).not.toMatch(/border-radius|rounded-/);
  });
});
