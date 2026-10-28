// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { toWorld } from '$lib/canvas/gpu/camera';
import { FrameFit, FramePickers, framePicker, frameSpace } from './frame-pick';
import { addTrack } from '@feega/motion-core/motion/timeline';
import { TrackKind } from '@feega/motion-core/motion/components';
import { groupClips } from '$lib/motion/group';

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

describe('framePicker at the playhead', () => {
  const brief = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2 } }, 'blink');
  if (!brief.ok) {
    throw new Error(brief.error);
  }
  const centre = { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2 };
  let head = 10;
  const blink = framePicker({ doc: brief.doc, tokens: FEEGA_TOKENS, assets: {} }, () => head);

  it('picks what is on screen at the playhead time', () => {
    expect(blink.pick(centre, space)).toBe('blink');
  });

  it('picks nothing once the playhead is past the clip', () => {
    head = 200;

    expect(blink.pick(centre, space)).toBeNull();
  });
});

describe('framePicker on a group', () => {
  it('picks the group, the element the doc knows, not its namespaced member', () => {
    const grouped = groupClips(added.doc, ['card'], () => 'grp');
    if (!grouped.ok) {
      throw new Error(grouped.error);
    }
    const inGroup = framePicker({ ...live, doc: grouped.doc });
    const outline = inGroup.outline('grp', space)!;

    expect(inGroup.pick({ x: outline.x + outline.w / 2, y: outline.y + outline.h / 2 }, space)).toBe('grp');
  });
});

describe('framePicker chain', () => {
  it('lists the group and the member under the point, outermost first', () => {
    const grouped = groupClips(added.doc, ['card'], () => 'grp');
    if (!grouped.ok) {
      throw new Error(grouped.error);
    }
    const inGroup = framePicker({ ...live, doc: grouped.doc });
    const outline = inGroup.outline('grp', space)!;

    expect(inGroup.chain({ x: outline.x + outline.w / 2, y: outline.y + outline.h / 2 }, space)).toEqual(['grp', 'grp__0__card']);
  });
});

describe('framePicker outlineQuad', () => {
  it('is the outline rect of an unrotated clip, in world space', () => {
    const outline = picker.outline('card', space)!;

    expect(picker.outlineQuad('card', space)).toEqual([
      { x: outline.x, y: outline.y },
      { x: outline.x + outline.w, y: outline.y },
      { x: outline.x + outline.w, y: outline.y + outline.h },
      { x: outline.x, y: outline.y + outline.h }
    ]);
  });
});

describe('a stretched frame space', () => {
  it('maps the frame onto the whole box, each axis on its own', () => {
    const stretched = frameSpace({ x: 10, y: 20, w: 400, h: 100 }, { width: 200, height: 200 }, 0, FrameFit.Stretch);
    expect(stretched.pointToWorld([200, 200])).toEqual({ x: 410, y: 120 });
    expect(stretched.toFrame({ x: 210, y: 70 })).toEqual([100, 100]);
  });
});

describe('a text at its first frame, still fading up', () => {
  const START = 60;
  const fading = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: START, durationInFrames: 90, props: { text: 'Hi', x: 0.1, y: 0.6, width: 0.4, height: 0.15 } }, 'copy');
  if (!fading.ok) {
    throw new Error(fading.error);
  }
  const atStart = framePicker({ doc: fading.doc, tokens: FEEGA_TOKENS, assets: {}, playhead: START });
  const centre = () => {
    const box = atStart.outline('copy', space)!;
    return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  };

  it('is still the element a double-click lands on once it is selected', () => {
    expect(atStart.pickHeld(centre(), space, ['copy'])).toBe('copy');
  });

  it('is not picked when nothing holds it', () => {
    expect(atStart.pickHeld(centre(), space, [])).toBeNull();
  });
});

describe('an image inserted in a frame', () => {
  const STAGE = { width: 1000, height: 530 };
  const stage = frameSpace({ x: 0, y: 0, w: STAGE.width, h: STAGE.height }, STAGE, 0);
  const backed = addClip({ ...newMotionDoc(MotionFormat.Landscape), ...STAGE }, { component: 'Shape', from: 0, durationInFrames: 150, props: { shape: 'rect', x: 0.05, y: 0.05, width: 0.9, height: 0.9 } }, 'back');
  const tracked = backed.ok ? addTrack(backed.doc, TrackKind.Visual, 'top') : backed;
  const placed = tracked.ok ? addClip(tracked.doc, { component: 'Image', from: 0, durationInFrames: 150, trackId: 'top', props: { x: 0.5, y: 0.5, width: 0.064, height: 0.12, assetId: 'shot', fit: 'contain' } }, 'img') : tracked;
  if (!placed.ok) {
    throw new Error(placed.error);
  }
  const centre = { x: STAGE.width / 2, y: STAGE.height / 2 };

  it('is picked once its file arrives, even though the doc did not change', () => {
    const pickers = new FramePickers();
    const uploading = { doc: placed.doc, tokens: FEEGA_TOKENS, assets: {} };
    pickers.of('frame', uploading).pick(centre, stage);

    const arrived = { ...uploading, assets: { shot: 'blob:https://app.test/0b1c' } };
    expect(pickers.of('frame', arrived).pick(centre, stage)).toBe('img');
  });

  it('reuses the picker while neither the doc nor the files change', () => {
    const pickers = new FramePickers();
    const live = { doc: placed.doc, tokens: FEEGA_TOKENS, assets: {} };

    expect(pickers.of('frame', live)).toBe(pickers.of('frame', { ...live }));
  });
});
