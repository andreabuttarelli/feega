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

  it('il nome lungo si tronca e resta leggibile nel tooltip', () => {
    expect(source).toMatch(/title={project\.name}/);
  });
});
