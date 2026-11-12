// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CanvasContextMenu from './CanvasContextMenu.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

let app: Record<string, unknown> | null = null;

afterEach(() => {
  if (app) {
    unmount(app);
  }
  app = null;
  document.body.innerHTML = '';
});

describe('canvas context menu', () => {
  it('Escape closes the menu without reaching the canvas, so the selection stays', () => {
    const canvas = vi.fn();
    const onclose = vi.fn();
    window.addEventListener('keydown', canvas);
    app = mount(CanvasContextMenu, { target: document.body, props: { at: { x: 10, y: 10 }, summaries: [], available: new Set(), onpick: vi.fn(), onclose } });
    flushSync();

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(onclose).toHaveBeenCalledTimes(1);
    expect(canvas).not.toHaveBeenCalled();
    window.removeEventListener('keydown', canvas);
  });
});
