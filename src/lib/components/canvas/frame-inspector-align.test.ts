// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('svelte', async () => await import(join(dirname(fileURLToPath(import.meta.url)), '../../../../node_modules/svelte/src/index-client.js')));
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
import { wrapInFrame } from '$lib/motion/layout/ops';
import { aabb, quadOf } from '$lib/motion/scene-select';
import { propBoxes } from '$lib/motion/space';
import FrameInspectorPanel from './FrameInspectorPanel.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const rect = (doc: MotionDoc, id: string, x: number, y: number, size: number) => must(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', x, y, width: size, height: size } }, id));

function framedSession() {
  const doc = must(wrapInFrame(rect(rect(newMotionDoc(MotionFormat.Square), 'card', 0.3, 0.3, 0.4), 'dot', 0.2, 0.2, 0.05), ['card', 'dot'], 'box', 'lane'));
  return new FrameEditSession(
    { head: { version: 1, doc }, selection: ['dot'] },
    { viewPath: () => [], show: () => {}, recorded: () => {}, stepped: () => {}, playhead: () => 0, saved: () => {}, landed: () => {}, pull: async () => {}, send: async () => ({ ok: false, error: 'off' }), draft: () => {} }
  );
}

let app: Record<string, unknown> | null = null;

afterEach(() => {
  if (app) {
    unmount(app);
    app = null;
  }
  document.body.innerHTML = '';
});

describe('the Alignment section of one element', () => {
  it('centres an element on the frame it sits in', () => {
    const session = framedSession();
    app = mount(FrameInspectorPanel, { target: document.body, props: { session, tokens: FEEGA_TOKENS } });
    flushSync();

    document.querySelector<HTMLButtonElement>('[data-part="align"] [data-align="center"]')!.click();
    flushSync();

    const doc = session.history.present;
    const centre = (id: string) => {
      const b = aabb(quadOf(doc, id, 0, propBoxes(doc)[id]));
      return (b.left + b.right) / 2;
    };

    expect(centre('dot')).toBeCloseTo(centre('box'), 3);
  });
});
