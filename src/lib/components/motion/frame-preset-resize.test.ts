// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FramePresetSection from './FramePresetSection.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

let app: Record<string, unknown> | null = null;

afterEach(() => {
  if (app) {
    unmount(app);
    app = null;
  }
  document.body.innerHTML = '';
});

function shown() {
  const resize = vi.fn();
  app = mount(FramePresetSection, { target: document.body, props: { place: { x: 0, y: 0, w: 390, h: 844, rotation: 0, set: () => undefined, resize, grow: () => undefined, turn: () => undefined, flip: () => undefined, align: null } } });
  flushSync();
  return { resize, field: (id: string) => document.querySelector<HTMLInputElement>(`[data-testid="${id}"]`)!, preset: document.querySelector<HTMLSelectElement>('[data-testid="frame-preset"]')! };
}

const type = (input: HTMLInputElement | HTMLSelectElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
};

describe('typing a frame size', () => {
  it('resizes the frame on the canvas at once, as a handle drag does', () => {
    const { resize, field } = shown();
    type(field('frame-height'), '1100');

    expect(resize).toHaveBeenCalledWith(390, 1100);
  });

  it('a preset makes the frame that big on the canvas', () => {
    const { resize, preset } = shown();
    type(preset, 'desktop');

    expect(resize).toHaveBeenCalledWith(1440, 1024);
  });
});
