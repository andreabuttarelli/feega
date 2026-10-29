import { describe, expect, it, vi } from 'vitest';
import { FrameKind } from '$lib/canvas/motion-node';
import { MOTION_NODE_BAR_H } from '$lib/canvas/motion-node';
import { drawsAny, framesOnCanvas, logGaps, onStage, sameLive, stillFrame, toFetch } from './frame-source';
import instance from '../../../../tests/e2e/fixtures/motion-doc-template-instance.json';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { TransitionKind } from '@feega/motion-core/motion/design';

const tile = (id: string, kind = 'motion') => ({ id, kind, x: 10, y: 20, w: 300, h: 200 });

describe('frames on canvas', () => {
  it('a frame shows its doc in the stage above the bar, at its head revision', () => {
    const [f] = framesOnCanvas([tile('a')], () => ({ kind: FrameKind.Frame, docHeadRevision: 4 }));
    expect(f).toEqual({ id: 'a', kind: FrameKind.Frame, revision: 4, box: { x: 10, y: 20, w: 300, h: 200 - MOTION_NODE_BAR_H } });
  });

  it('a rotated tile turns its frame about the tile centre', () => {
    const [f] = framesOnCanvas([{ ...tile('a'), rotation: 20 }], () => ({ kind: FrameKind.Element, docHeadRevision: 1 }));
    expect(f.turn).toEqual({ degrees: 20, about: { x: 160, y: 120 } });
  });

  it('a frame holding instances is fetched again when one of their mains changes', () => {
    const before = framesOnCanvas([tile('a')], () => ({ kind: FrameKind.Frame, docHeadRevision: 4, linked: { home: 'x1' } }))[0];
    const after = framesOnCanvas([tile('a')], () => ({ kind: FrameKind.Frame, docHeadRevision: 4, linked: { home: 'x2' } }))[0];

    expect(before.linked).toBeTruthy();
    expect(after.linked).not.toBe(before.linked);
  });

  it('elements and groups have no bar', () => {
    const [f] = framesOnCanvas([tile('a')], () => ({ kind: FrameKind.Element, docHeadRevision: 1 }));
    expect(f.box.h).toBe(200);
  });

  it('skips non-motion tiles and frames with no saved doc yet', () => {
    expect(framesOnCanvas([tile('t', 'text'), tile('n')], () => ({ kind: FrameKind.Frame, docHeadRevision: 0 }))).toEqual([]);
  });
});

describe('handing a frame to the core', () => {
  const list = (gaps: number, items: unknown[] = [{ kind: 'path', clip: 'p' }]) => ({ width: 1, height: 1, background: null, items, unsupported: Array.from({ length: gaps }, () => ({ clip: 'c', component: 'Custom', reason: 'custom' })) }) as never;

  it('a frame the core draws even in part leaves its poster, rather than stay black', () => {
    expect(drawsAny(list(0))).toBe(true);
    expect(drawsAny(list(2))).toBe(true);
  });

  it('names every element the core left out of a frame it drew', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logGaps('f1', list(0));
    logGaps('f1', { ...(list(0) as object), unsupported: [{ clip: 'c', component: 'Custom', reason: 'dom', detail: 'mask div.x ×2' }] } as never);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0].join(' ')).toContain('c (Custom): mask div.x ×2');
    warn.mockRestore();
  });

  it('leaves the poster to a frame whose still draws nothing, rather than paint its bare background over it', () => {
    expect(drawsAny(list(0, []))).toBe(false);
  });
});

describe('still frame', () => {
  it('a frame rests at time 0', () => {
    expect(stillFrame(newMotionDoc(MotionFormat.Landscape))).toBe(0);
  });

  it('a still doc rests on its own still frame', () => {
    expect(stillFrame({ ...newMotionDoc(MotionFormat.Landscape), still: { frame: 7 } })).toBe(7);
  });

  it('a doc longer than its content rests once its text has faded in', () => {
    expect(stillFrame(instance as unknown as MotionDoc)).toBe(12);
  });

  it('a clip from 0 to 1s in a 5s frame is drawn on the canvas', () => {
    const doc = { fps: 30, durationInFrames: 150, tracks: [], comps: {} } as unknown as MotionDoc;
    const clip = { from: 0, durationInFrames: 30 };
    const at = stillFrame(doc);
    expect(at >= clip.from && at < clip.from + clip.durationInFrames).toBe(true);
  });
});

describe('the frame a video rests on', () => {
  const blank = newMotionDoc(MotionFormat.Landscape);
  const words = (id: string, frames: number, fadeIn: number) => ({ id, component: 'Text', from: 0, durationInFrames: frames, props: { text: id, x: 0.5, y: 0.5, width: 0.5, height: 0.2 }, transitionIn: { kind: fadeIn ? TransitionKind.Fade : TransitionKind.None, durationInFrames: fadeIn } });
  const video = (...clips: object[]): MotionDoc => {
    const verdict = parseMotionDoc({ ...blank, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips }] });
    if (!verdict.ok) {
      throw new Error(verdict.error);
    }
    return verdict.doc;
  };

  it('a title that fades in rests once it is fully shown, never invisible at time 0', () => {
    const at = stillFrame(video(words('title', 150, 15)));
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThanOrEqual(15);
  });

  it('never rests past a clip that is on screen at time 0', () => {
    expect(stillFrame(video(words('title', 150, 45), words('flash', 10, 0)))).toBeLessThan(10);
  });

  it('a frame with nothing fading in still rests at time 0', () => {
    const shape = { id: 'card', component: 'Shape', from: 0, durationInFrames: 150, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.1, height: 0.1, fill: '#ff0000' } };
    expect(stillFrame(video(shape))).toBe(0);
  });
});

describe('a transparent doc on the canvas', () => {
  const list = (background: [number, number, number, number] | null) => ({ width: 1, height: 1, background, items: [], unsupported: [] });

  it('a frame shows it on the black stage, as its card always has', () => {
    expect(onStage(list(null), FrameKind.Frame).background).toEqual([0, 0, 0, 1]);
  });

  it('elements and groups stay see-through, and an opaque doc keeps its own colour', () => {
    expect(onStage(list(null), FrameKind.Element).background).toBeNull();
    expect(onStage(list([1, 0, 0, 1]), FrameKind.Frame).background).toEqual([1, 0, 0, 1]);
  });
});

describe('frames to fetch', () => {
  const at = (id: string, revision: number) => ({ id, kind: FrameKind.Frame, revision, box: { x: 0, y: 0, w: 10, h: 10 } });
  const keyOf = (f: { id: string; revision: number }) => `${f.id}:${f.revision}`;

  it('a frame drawn from its live doc is not fetched again when a save bumps its revision', () => {
    const frames = [at('edited', 8), at('other', 3)];

    expect(toFetch(frames, keyOf, new Set(['edited:7']), new Set(['edited'])).map((f) => f.id)).toEqual(['other']);
  });

  it('a frame already asked for at this revision is not fetched twice', () => {
    expect(toFetch([at('a', 2)], keyOf, new Set(['a:2']), new Set())).toEqual([]);
  });
});

describe('same live doc', () => {
  const doc = newMotionDoc(MotionFormat.Landscape);
  const live = { doc, tokens: {} as never, assets: {}, playhead: 3 };

  it('a save that hands back the same doc is no new picture to draw', () => {
    expect(sameLive(live, { ...live })).toBe(true);
  });

  it('a new doc, files or playhead is', () => {
    expect(sameLive(live, { ...live, doc: { ...doc } })).toBe(false);
    expect(sameLive(live, { ...live, assets: {} })).toBe(false);
    expect(sameLive(live, { ...live, playhead: 4 })).toBe(false);
    expect(sameLive(undefined, live)).toBe(false);
  });
});
