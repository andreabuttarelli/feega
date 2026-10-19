import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, type OpResult } from '../timeline';
import { prepare } from './display-list';
import { coreExportable } from './core-export';

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

    expect(coreExportable(prepare(doc, FEEGA_TOKENS), [0, 0.5, 0.96])).toBe(true);
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
});
