import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import AutoLayoutOverlay from './AutoLayoutOverlay.svelte';
import { MotionFormat, findClip, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { wrapInStack } from '$lib/motion/layout/ops';
import type { AutoLayout } from '@feega/motion-core/motion/layout/model';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const shape = (x: number) => ({ component: 'Shape', from: 0, durationInFrames: 60, props: { shape: 'rect', x, y: 0.5, width: 0.2, height: 0.2 } }) as const;
const doc = must(wrapInStack(must(addClip(must(addClip(newMotionDoc(MotionFormat.Landscape), shape(0.3), 'a')), shape(0.7), 'b')), ['a', 'b'], 'row', 'lane'));
const row = findClip(doc, 'row')!.clip as MotionClip & { autoLayout: AutoLayout };

const bandStyle = (body: string, band: string) => body.match(new RegExp(`data-band="${band}"[^>]*style="([^"]*)"`))?.[1] ?? body.match(new RegExp(`style="([^"]*)"[^>]*data-band="${band}"`))?.[1] ?? '';

describe('padding handles of a stack with no padding', () => {
  const body = render(AutoLayoutOverlay, { props: { doc, clip: row, onchange: () => {} } }).body;

  it('sit inside the stack, off the edges the resize handles own', () => {
    expect(bandStyle(body, 'right')).toMatch(/right:/);
    expect(bandStyle(body, 'right')).not.toMatch(/left:/);
    expect(bandStyle(body, 'bottom')).toMatch(/bottom:/);
    expect(bandStyle(body, 'bottom')).not.toMatch(/top:/);
    expect(body).toMatch(/data-band="left"[^>]*data-inset|data-inset[^>]*data-band="left"/);
  });
});
