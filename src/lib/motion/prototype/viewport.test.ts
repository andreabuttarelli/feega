import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addBreakpoint, BASE_BREAKPOINT, BreakpointPreset } from '@feega/motion-core/motion/breakpoints/model';
import { ViewportMode, WIDTH_PRESETS, activeView, clampWidth, frameBox, parseViewport } from './viewport';

const stage = { w: 1000, h: 600 };
const frame = { w: 1440, h: 3000 };

function withViews() {
  let doc = { ...newMotionDoc(MotionFormat.Landscape), width: 1440 };
  for (const [preset, id] of [[BreakpointPreset.Tablet, 'tablet'], [BreakpointPreset.Phone, 'phone']] as const) {
    const added = addBreakpoint(doc, preset, id);
    if (!added.ok) {
      throw new Error(added.error);
    }
    doc = added.doc;
  }
  return doc;
}

describe('frameBox', () => {
  it('Fit contains the whole frame on every side', () => {
    const box = frameBox(ViewportMode.Fit, stage, frame, 0);
    expect(box.scale).toBeCloseTo(0.2);
    expect(box.w * box.scale).toBeLessThanOrEqual(stage.w);
    expect(box.h * box.scale).toBeLessThanOrEqual(stage.h);
    expect(box.scrolls).toBe(false);
  });

  it('Fill width scales to the stage width and scrolls vertically', () => {
    const box = frameBox(ViewportMode.FillWidth, stage, frame, 0);
    expect(box.w * box.scale).toBeCloseTo(stage.w);
    expect(box.scrolls).toBe(true);
  });

  it('Actual size is 1 and scrolls', () => {
    expect(frameBox(ViewportMode.Actual, stage, frame, 0)).toMatchObject({ scale: 1, w: 1440, h: 3000, scrolls: true });
  });

  it('Responsive takes the width asked and keeps scale 1 while it fits', () => {
    expect(frameBox(ViewportMode.Responsive, stage, frame, 390)).toMatchObject({ w: 390, scale: 1, scrolls: true });
  });

  it('Responsive wider than the stage shrinks to fit the width', () => {
    const box = frameBox(ViewportMode.Responsive, stage, frame, 2000);
    expect(box.w).toBe(2000);
    expect(box.scale).toBeCloseTo(0.5);
  });

  it('an empty stage never yields a zero or NaN scale', () => {
    expect(frameBox(ViewportMode.Fit, { w: 0, h: 0 }, frame, 0).scale).toBeGreaterThan(0);
  });
});

describe('activeView', () => {
  const doc = withViews();

  it('is Desktop at the frame width and wider', () => {
    expect(activeView(doc, 1440).id).toBe(BASE_BREAKPOINT);
    expect(activeView(doc, 1800).id).toBe(BASE_BREAKPOINT);
  });

  it('switches when the width crosses a breakpoint', () => {
    expect(activeView(doc, 811).id).toBe(BASE_BREAKPOINT);
    expect(activeView(doc, 810).id).toBe('tablet');
    expect(activeView(doc, 391).id).toBe('tablet');
    expect(activeView(doc, 390).id).toBe('phone');
    expect(activeView(doc, 320).id).toBe('phone');
  });

  it('is Desktop when the frame has no breakpoints', () => {
    expect(activeView(newMotionDoc(MotionFormat.Landscape), 300).id).toBe(BASE_BREAKPOINT);
  });
});

describe('clampWidth and parseViewport', () => {
  it('keeps the width in range and whole', () => {
    expect(clampWidth(10)).toBeGreaterThanOrEqual(120);
    expect(clampWidth(999999)).toBeLessThanOrEqual(4096);
    expect(clampWidth(390.6)).toBe(391);
    expect(clampWidth(Number.NaN)).toBe(WIDTH_PRESETS[0].width);
  });

  it('reads a stored choice and ignores junk', () => {
    expect(parseViewport('{"mode":"responsive","width":390}')).toEqual({ mode: ViewportMode.Responsive, width: 390 });
    expect(parseViewport('nope')).toEqual({ mode: ViewportMode.Fit, width: WIDTH_PRESETS[0].width });
    expect(parseViewport('{"mode":"zzz","width":5}').mode).toBe(ViewportMode.Fit);
    expect(parseViewport(null).mode).toBe(ViewportMode.Fit);
  });
});
