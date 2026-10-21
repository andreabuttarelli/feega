// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { toWorld } from '$lib/canvas/gpu/camera';
import { framePicker, frameSpace, unifiedFrames } from './frame-pick';

const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 900, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2 } }, 'card');
if (!added.ok) {
  throw new Error(added.error);
}
const live = { doc: added.doc, tokens: FEEGA_TOKENS, assets: {} };

const BOX = { x: 1000, y: 400, w: 960, h: 540 };
const space = frameSpace(BOX, { width: 1920, height: 1080 }, 0);
const picker = framePicker(live);

describe('frameSpace', () => {
  it('maps the frame corners onto the tile box', () => {
    expect(space.toFrame({ x: BOX.x, y: BOX.y })).toEqual([0, 0]);
    expect(space.toFrame({ x: BOX.x + BOX.w, y: BOX.y + BOX.h })).toEqual([1920, 1080]);
  });

  it('keeps the frame centred when the tile is taller than the stage', () => {
    const tall = frameSpace({ x: 0, y: 0, w: 960, h: 740 }, { width: 1920, height: 1080 }, 0);

    expect(tall.toFrame({ x: 0, y: 100 })).toEqual([0, 0]);
  });

  it('undoes the tile rotation about its centre', () => {
    const turned = frameSpace({ x: 0, y: 0, w: 200, h: 100 }, { width: 200, height: 100 }, 90);
    const [x, y] = turned.toFrame({ x: 150, y: 50 });

    expect(x).toBeCloseTo(100, 5);
    expect(y).toBeCloseTo(0, 5);
  });
});

describe('framePicker under pan and zoom', () => {
  const view = { x: -300, y: 120, zoom: 0.5 };
  const screenOf = (w: { x: number; y: number }) => ({ x: w.x * view.zoom + view.x, y: w.y * view.zoom + view.y });

  it('outlines the clip where the screen shows it', () => {
    const outline = picker.outline('card', space)!;

    const topLeft = screenOf({ x: outline.x, y: outline.y });
    expect(topLeft.x).toBeCloseTo((BOX.x + 384) * view.zoom + view.x, 5);
    expect(outline.w).toBeCloseTo(192, 5);
  });

  it('picks the clip at the screen point its outline covers', () => {
    const outline = picker.outline('card', space)!;
    const screen = screenOf({ x: outline.x + outline.w / 2, y: outline.y + outline.h / 2 });

    expect(picker.pick(toWorld(view, screen), space)).toBe('card');
  });

  it('picks nothing just outside its outline', () => {
    const outline = picker.outline('card', space)!;
    const screen = screenOf({ x: outline.x - 10, y: outline.y + outline.h / 2 });

    expect(picker.pick(toWorld(view, screen), space)).toBeNull();
  });

  it('picks nothing in the letterbox around the stage', () => {
    const tall = frameSpace({ x: 1000, y: 400, w: 960, h: 740 }, { width: 1920, height: 1080 }, 0);

    expect(picker.pick({ x: 1480, y: 410 }, tall)).toBeNull();
  });
});

describe('framePicker in frame pixels', () => {
  it('gives the clip rect in the pixels of the doc', () => {
    expect(picker.frameRect('card')).toEqual({ left: 768, top: 432, width: 384, height: 216 });
  });

  it('gives the size of the frame it draws', () => {
    expect(picker.frameSize()).toEqual({ width: 1920, height: 1080 });
  });

  it('gives a world point in the pixels of the doc', () => {
    expect(picker.framePoint({ x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2 }, space)).toEqual([960, 540]);
  });
});

describe('unifiedFrames', () => {
  it('is on unless switched off in the address', () => {
    expect(unifiedFrames(new URL('https://app.test/p'))).toBe(true);
    expect(unifiedFrames(new URL('https://app.test/p?unifiedFrames=0'))).toBe(false);
  });
});
