// @vitest-environment jsdom
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import AutoLayoutOverlay from './AutoLayoutOverlay.svelte';
import { MotionFormat, findClip, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { setAutoLayout, wrapInStack } from '$lib/motion/layout/ops';
import type { AutoLayout } from '@feega/motion-core/motion/layout/model';

const dir = dirname(fileURLToPath(import.meta.url));
const { flushSync, mount, unmount } = (await import(join(dir, '../../../../node_modules/svelte/src/index-client.js'))) as typeof import('svelte');

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const shape = (x: number) => ({ component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x, y: 0.5, width: 0.2, height: 0.2 } }) as const;
const before = must(wrapInStack(must(addClip(must(addClip(newMotionDoc(MotionFormat.Landscape), shape(0.3), 'a')), shape(0.7), 'b')), ['a', 'b'], 'row', 'lane'));
const after = must(setAutoLayout(before, 'row', { gap: 120 }));
const rowOf = (doc: MotionDoc) => findClip(doc, 'row')!.clip as MotionClip & { autoLayout: AutoLayout };

const apps: Record<string, unknown>[] = [];

afterEach(() => {
  apps.splice(0).forEach((app) => unmount(app));
  document.body.innerHTML = '';
});

function shown() {
  const waiting: (() => void)[] = [];
  const props = $state({ doc: before, clip: rowOf(before), onchange: () => {}, afterPaint: (job: () => void) => void waiting.push(job) });
  apps.push(mount(AutoLayoutOverlay, { target: document.body, props }));
  flushSync();
  const gap = () => document.querySelector<HTMLElement>('[data-band="gap"]')?.getAttribute('style');
  return { props, gap, paint: () => (waiting.splice(0).forEach((job) => job()), flushSync()) };
}

describe('auto layout strips drawn after the frame that shows the edit', () => {
  it('keep the painted layout until the frame is drawn, then follow the edit', () => {
    const { props, gap, paint } = shown();
    const painted = gap();

    props.doc = after;
    props.clip = rowOf(after);
    flushSync();
    expect(gap()).toBe(painted);

    paint();
    expect(gap()).not.toBe(painted);
  });

  it('follow the edit at once when no painter is given', () => {
    const waiting: (() => void)[] = [];
    const props = $state({ doc: before, clip: rowOf(before), onchange: () => {} });
    apps.push(mount(AutoLayoutOverlay, { target: document.body, props }));
    flushSync();
    const painted = document.querySelector('[data-band="gap"]')?.getAttribute('style');

    props.doc = after;
    props.clip = rowOf(after);
    flushSync();

    expect(waiting).toEqual([]);
    expect(document.querySelector('[data-band="gap"]')?.getAttribute('style')).not.toBe(painted);
  });
});
