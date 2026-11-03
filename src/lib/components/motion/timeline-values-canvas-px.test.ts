import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import MotionTimeline from './MotionTimeline.svelte';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, setKeyframes } from '@feega/motion-core/motion/timeline';
import { Ease } from '@feega/motion-core/motion/design';
import { Reveal, Snap } from '$lib/motion/timeline-view';

const LEGACY_SCALE = 0.5;

function shifted(): MotionDoc {
  const added = addClip(newMotionDoc(MotionFormat.Vertical), { component: 'Shape', from: 0, durationInFrames: 60 }, 'box');
  if (!added.ok) {
    throw new Error(added.error);
  }
  const keyed = setKeyframes(added.doc, 'box', 'x', [
    { frame: 0, value: 0.1, ease: Ease.Linear },
    { frame: 30, value: 0.1, ease: Ease.Linear }
  ]);
  if (!keyed.ok) {
    throw new Error(keyed.error);
  }
  return keyed.doc;
}

const xValue = (scale?: number) => {
  const body = render(MotionTimeline, { props: { doc: shifted(), selection: ['box'], reveal: Reveal.Position, snap: Snap.Off, ...(scale === undefined ? {} : { scale }), onchange: () => {} } }).body;
  return /aria-label="Offset X value"[^>]*>([^<]*)</.exec(body)?.[1];
};

describe('timeline value fields', () => {
  it('read a pixel value in canvas px on a frame drawn at two doc px per canvas px', () => {
    expect(xValue(LEGACY_SCALE)).toBe('54');
  });

  it('read doc px when nothing says the frame is scaled', () => {
    expect(xValue()).toBe('108');
  });
});
