import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canvasActionUrl } from './canvas-action-url';

const RELATIVE_ACTION = /['"`]\?\//;
const CANVAS_PAGE = 'src/routes/p/[projectId]/c/[canvasId]/+page.svelte';
const CANVAS_COMPONENTS = 'src/lib/components/canvas';

function canvasSources(): string[] {
  const components = readdirSync(CANVAS_COMPONENTS)
    .filter((name) => name.endsWith('.svelte'))
    .map((name) => join(CANVAS_COMPONENTS, name));
  return [CANVAS_PAGE, ...components];
}

describe('canvas actions target the canvas route, whatever the URL says', () => {
  it('builds the absolute action path', () => {
    expect(canvasActionUrl({ projectId: 'p1', canvasId: 'c1' }, 'write')).toBe('/p/p1/c/c1?/write');
  });

  it('una scheda aperta con pushState non devia le azioni della tela verso la sua route', () => {
    const relative = canvasSources().filter((path) => RELATIVE_ACTION.test(readFileSync(path, 'utf8')));
    expect(relative).toEqual([]);
  });
});
