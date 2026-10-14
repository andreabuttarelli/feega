// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { wrapInAutoLayout } from '$lib/motion/layout/ops';
import { addClip, type OpResult } from '$lib/motion/timeline';
import AutoLayoutOverlay from './AutoLayoutOverlay.svelte';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const row = (() => {
  let doc = newMotionDoc(MotionFormat.Square);
  doc = must(addClip(doc, { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.2, y: 0.5, width: 0.1, height: 0.1 } }, 'a'));
  doc = must(addClip(doc, { component: 'Shape', from: 0, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1 } }, 'b'));
  doc = must(addClip(doc, { component: 'Shape', from: 0, props: { shape: 'rect' } }, 'plain'));
  return must(wrapInAutoLayout(doc, ['a', 'b'], 'box', 'lane'));
})();

const clip = (doc: MotionDoc, id: string) => findClip(doc, id)!.clip;

describe('the auto layout overlay', () => {
  it('draws a strip for each padding side and each gap', () => {
    const app = mount(AutoLayoutOverlay, { target: document.body, props: { doc: row, clip: { ...clip(row, 'box'), autoLayout: clip(row, 'box').autoLayout! }, onchange: () => {} } });
    flushSync();
    expect([...document.querySelectorAll<HTMLElement>('[data-strip]')].map((s) => s.dataset.strip)).toEqual(['top', 'bottom', 'left', 'right', 'gap']);
    unmount(app);
    document.body.innerHTML = '';
  });

  it('dragging the gap writes the new gap', () => {
    let next: MotionDoc | null = null;
    const app = mount(AutoLayoutOverlay, { target: document.body, props: { doc: row, clip: { ...clip(row, 'box'), autoLayout: clip(row, 'box').autoLayout! }, onchange: (d: MotionDoc) => (next = d) } });
    flushSync();
    const host = document.querySelector<HTMLElement>('[data-testid="auto-layout-overlay"]')!;
    host.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1080, height: 1080, right: 1080, bottom: 1080, x: 0, y: 0, toJSON: () => ({}) });
    const gap = document.querySelector<HTMLElement>('[data-strip="gap"]')!;
    gap.setPointerCapture = () => {};
    const at = (type: string, x: number) => gap.dispatchEvent(Object.assign(new MouseEvent(type, { clientX: x, clientY: 500, bubbles: true }), { pointerId: 1 }));
    at('pointerdown', 300);
    at('pointermove', 340);
    at('pointerup', 340);
    flushSync();
    expect(clip(next!, 'box').autoLayout!.gap).toBe(clip(row, 'box').autoLayout!.gap + 40);
    unmount(app);
    document.body.innerHTML = '';
  });
});
