// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GridToggle } from '$lib/motion/pixel-grid';
import PixelGridOverlay from './PixelGridOverlay.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

let app: Record<string, unknown> | null = null;

afterEach(() => {
  vi.restoreAllMocks();
  if (app) {
    unmount(app);
    app = null;
  }
  document.body.innerHTML = '';
});

function measuredWith(toggle: GridToggle): number {
  const measure = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  app = mount(PixelGridOverlay, { target: document.body, props: { width: 100, height: 100, toggle } });
  flushSync();
  return measure.mock.calls.length;
}

describe('the pixel grid overlay', () => {
  it('measures nothing while the grid is off: a canvas mounts one per frame, and each measure forces a layout', () => {
    expect(measuredWith(GridToggle.Off)).toBe(0);
  });

  it('measures its shown size while the grid is on, to know when pixels are big enough to draw', () => {
    expect(measuredWith(GridToggle.On)).toBeGreaterThan(0);
  });
});
