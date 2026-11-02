import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import MotionInspector from '$lib/components/motion/MotionInspector.svelte';
import { radiusRange, radiusShown, radiusStored } from './radius-px';

const box = { width: 400, height: 200 };

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

describe('radius in px', () => {
  it('typing 12 stores a roundness that renders a 12px radius', () => {
    expect(radiusStored(12, box) * Math.min(box.width, box.height)).toBeCloseTo(12);
  });

  it('typing past half the short side stops at half', () => {
    expect(radiusStored(500, box)).toBe(0.5);
  });

  it('shows the stored roundness as px', () => {
    expect(radiusShown(0.06, box)).toBe(12);
  });

  it('slider tops out at half the short side', () => {
    expect(radiusRange(box).max).toBe(100);
  });

  it('the inspector shows a stored 0.06 on a full-frame rect in px', () => {
    const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, roundness: 0.06 } }, 'r'));
    const html = render(MotionInspector, { props: { doc, clip: findClip(doc, 'r')!.clip, tokens: FEEGA_TOKENS, assets: [], frame: 0, onchange: () => {} } }).body;
    expect(html).toMatch(/data-testid="radius"[\s\S]*?value="65"/);
  });
});
