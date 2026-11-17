import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { standInFill } from './stand-in-fill';

const shape = (id: string, props: Record<string, unknown>) => newClip({ id, from: 0, durationInFrames: 30, component: 'Shape', props: { x: 0.5, y: 0.5, width: 1, height: 1, ...props } });

function pageOf(...clips: ReturnType<typeof shape>[]): MotionDoc {
  const doc = newMotionDoc(MotionFormat.Landscape);
  return { ...doc, tracks: [{ ...doc.tracks[0], clips }, ...doc.tracks.slice(1)] };
}

describe('the colour a frame shows before it is drawn', () => {
  it('is the fill of the page behind everything, not of the white surface under it', () => {
    const doc = { ...pageOf(shape('bg', { fill: '#07080a' }), shape('surface', { fill: '#ffffff' })), surface: 'surface' };

    expect(standInFill(doc)).toBe('#07080a');
  });

  it('skips a shape with its fills switched off and a band too small to stand for the page', () => {
    const doc = pageOf(shape('off', { fill: '#d9d9d9', fills: [] }), shape('nav', { fill: '#ff0000', height: 0.01 }), shape('bg', { fill: '#13111c' }));

    expect(standInFill(doc)).toBe('#13111c');
  });

  it('falls back to the surface, and to nothing on an empty frame', () => {
    const doc = { ...pageOf(shape('surface', { fills: [{ type: 'solid', color: '#fafafa', opacity: 1, visible: true }] })), surface: 'surface' };

    expect(standInFill(doc)).toBe('#fafafa');
    expect(standInFill(pageOf())).toBeNull();
  });
});
