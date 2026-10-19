import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canvasRouteOf } from './canvas-action-url';

const PAGE_ACTION = /\?\/\$?\{?[A-Za-z_]|x-sveltekit-action/;
const CANVAS_ACTION_CALLERS = [
  'src/routes/p/[projectId]/c/[canvasId]/+page.svelte',
  'src/routes/p/[projectId]/+layout.svelte',
  'src/lib/canvas/canvas-list.ts',
  'src/lib/canvas/media-uploader.ts',
  'src/lib/components/canvas/CanvasFlow.svelte',
  'src/lib/components/canvas/NextStepChips.svelte'
];

describe('canvas actions go to the API, whatever the URL says', () => {
  it('reads the canvas route from a canvas link', () => {
    expect(canvasRouteOf('/p/p1/c/c1')).toEqual({ projectId: 'p1', canvasId: 'c1' });
    expect(canvasRouteOf('/p/p1/assets')).toBeNull();
  });

  it('no canvas source posts to a page action', () => {
    const posting = CANVAS_ACTION_CALLERS.filter((path) => PAGE_ACTION.test(readFileSync(path, 'utf8')));
    expect(posting).toEqual([]);
  });
});
