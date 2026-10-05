import { describe, expect, it } from 'vitest';
import { FLAT_FRAME_MS, costSpans, frameCosts } from './render-cost';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import type { ComponentId } from './components';

function withClip(doc: MotionDoc, component: ComponentId, from: number, durationInFrames: number): MotionDoc {
  const added = addClip(doc, { component, from, durationInFrames }, `${component}-${from}`);
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

describe('render cost', () => {
  const doc = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 300 };

  it('a flat doc costs the same on every frame', () => {
    const costs = frameCosts(doc.durationInFrames, costSpans(doc));

    expect(new Set(costs)).toEqual(new Set([FLAT_FRAME_MS]));
  });

  it('a device mockup makes its own frames heavier, and only those', () => {
    const costs = frameCosts(doc.durationInFrames, costSpans(withClip(doc, 'Device3D', 60, 90)));

    expect(costs[59]).toBe(FLAT_FRAME_MS);
    expect(costs[60]).toBeGreaterThan(10 * FLAT_FRAME_MS);
    expect(costs[149]).toBe(costs[60]);
    expect(costs[150]).toBe(FLAT_FRAME_MS);
  });

  it('a device on a 4K frame costs more than on a 1080p one', () => {
    const device = withClip(doc, 'Device3D', 0, 30);
    const fhd = frameCosts(30, costSpans(device))[0];
    const uhd = frameCosts(30, costSpans(device, 3840 * 2160))[0];

    expect(uhd).toBeGreaterThan(fhd);
  });
});
