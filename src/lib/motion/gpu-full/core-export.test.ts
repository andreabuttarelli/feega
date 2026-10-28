import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { coreExportable, snapToFrame } from './core-export';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'BrandBackground', from: 0, durationInFrames: 30 }, 'bg'));

describe('export through the core', () => {
  it('takes a video whose every frame the core draws', () => {
    const doc = must(addClip(base, { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', fill: '#ff0000' } }, 'card'));

    expect(coreExportable(prepare(doc, FEEGA_TOKENS), [0, 15 / doc.fps, 29 / doc.fps])).toBe(true);
  });

  it('leaves a video to the HTML engine when one frame has something the core does not draw', () => {
    const doc = must(addClip(base, { component: 'Device3D', from: 10, durationInFrames: 10 }, 'device'));

    expect(coreExportable(prepare(doc, FEEGA_TOKENS), [0])).toBe(true);
    expect(coreExportable(prepare(doc, FEEGA_TOKENS), [0, 0.5])).toBe(false);
  });

  it('takes a video whose custom components the DOM reader draws for it', () => {
    const doc = must(addClip(base, { component: 'Device3D', from: 10, durationInFrames: 10 }, 'device'));

    expect(coreExportable(prepare(doc, FEEGA_TOKENS), [0, 0.5], new Set(['device']))).toBe(true);
  });

  it('leaves motion blur to the HTML engine, whose sub-frame samples the core would collapse into one frame', () => {
    const doc = must(addClip(base, { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', fill: '#ff0000' } }, 'card'));
    const fps = doc.fps;

    expect(coreExportable(prepare(doc, FEEGA_TOKENS), [0, 1 / fps, 2 / fps])).toBe(true);
    expect(coreExportable(prepare(doc, FEEGA_TOKENS), [0.25 / fps, 0.75 / fps])).toBe(false);
  });
});

describe('a still through the core', () => {
  it('lands on the frame nearest the asked second, so the core is willing to draw it', () => {
    const prepared = prepare(base, FEEGA_TOKENS);

    expect(snapToFrame(base, 0.5)).toBe(15 / base.fps);
    expect(snapToFrame(base, 0.52)).toBe(16 / base.fps);
    expect(coreExportable(prepared, [snapToFrame(base, 0.52)])).toBe(true);
  });
});
