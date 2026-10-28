import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, setProps } from '../timeline';
import { movingSquare, SQUARE_SIZE } from './scene';
import { ApplyMode, applyTrack, trackClip, type ClipTrack, type LumaReader } from './track-clip';

const W = 160;
const H = 90;
const CENTRE = SQUARE_SIZE / 2;
const CLIP_FROM = 10;

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

function docWith(clipProps: Record<string, unknown> = {}): MotionDoc {
  const base = newMotionDoc(MotionFormat.Landscape);
  const video = must(addClip(base, { component: 'Video', from: CLIP_FROM, durationInFrames: 40, props: clipProps }, 'v1'));
  return must(addClip(video, { component: 'Title', from: 0, durationInFrames: 60 }, 't1'));
}

const squareReader = (fps: number): LumaReader => async (seconds) => seconds.map((s) => movingSquare(W, H, 20 + Math.round(s * fps) * 3, 20 + Math.round(s * fps)));
const centreAt = (sourceFrame: number) => ({ x: (20 + sourceFrame * 3 + CENTRE) / W, y: (20 + sourceFrame + CENTRE) / H });

describe('track a video clip', () => {
  it('returns one point per clip frame, keyed on the clip, following the square', async () => {
    const doc = docWith();
    const request = { clipId: 'v1', frame: 0, point: centreAt(0), range: { from: 0, to: 20 } };

    const out = await trackClip(doc, request, squareReader(doc.fps));

    if (!out.ok) {
      throw new Error(out.error);
    }
    expect(out.track.points.map((p) => p.frame)).toEqual(Array.from({ length: 21 }, (_, i) => i));
    expect(Math.abs(out.track.points[20].x - centreAt(20).x) * W).toBeLessThan(1);
  });

  it('tracks both ways from a frame in the middle of the range', async () => {
    const doc = docWith();
    const request = { clipId: 'v1', frame: 10, point: centreAt(10), range: { from: 4, to: 16 } };

    const out = await trackClip(doc, request, squareReader(doc.fps));

    if (!out.ok) {
      throw new Error(out.error);
    }
    expect(out.track.points.map((p) => p.frame)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(Math.abs(out.track.points[0].x - centreAt(4).x) * W).toBeLessThan(1);
  });

  it('samples the source time the clip shows, so a trimmed video tracks the right frames', async () => {
    const trimmed = must(setProps(docWith(), 'v1', { speed: 2 }));
    const request = { clipId: 'v1', frame: 0, point: centreAt(0), range: { from: 0, to: 5 } };

    const out = await trackClip(trimmed, request, squareReader(trimmed.fps));

    if (!out.ok) {
      throw new Error(out.error);
    }
    expect(Math.abs(out.track.points[5].x - centreAt(10).x) * W).toBeLessThan(1);
  });

  it('refuses a clip that is not a video and a frame outside the clip', async () => {
    const doc = docWith();
    const read = squareReader(doc.fps);

    expect(await trackClip(doc, { clipId: 't1', frame: 0, point: { x: 0.5, y: 0.5 }, range: { from: 0, to: 5 } }, read)).toMatchObject({ ok: false, error: expect.stringContaining('Video') });
    expect(await trackClip(doc, { clipId: 'v1', frame: 99, point: { x: 0.5, y: 0.5 }, range: { from: 0, to: 5 } }, read)).toMatchObject({ ok: false });
    expect(await trackClip(doc, { clipId: 'nope', frame: 0, point: { x: 0.5, y: 0.5 }, range: { from: 0, to: 5 } }, read)).toMatchObject({ ok: false, error: 'no clip nope' });
  });
});

const TRACK: ClipTrack = {
  clipId: 'v1',
  anchor: 2,
  lost: false,
  points: [
    { frame: 2, x: 0.5, y: 0.5, score: 1 },
    { frame: 3, x: 0.6, y: 0.55, score: 0.99 },
    { frame: 4, x: 0.7, y: 0.6, score: 0.98 }
  ]
};

const keysOf = (doc: MotionDoc, clipId: string, prop: string) => findClip(doc, clipId)!.clip.keyframes[prop].map((k) => [k.frame, Math.round((k.value as number) * 1000) / 1000]);

describe('apply a track to a layer', () => {
  it('follows the point: position keyframes on the target, in its own frames, plus the offset', () => {
    const doc = docWith();

    const out = applyTrack(doc, TRACK, { targetClipId: 't1', mode: ApplyMode.Follow, offset: { x: 96, y: -54 } });

    if (!out.ok) {
      throw new Error(out.error);
    }
    const dx = 96 / doc.width;
    const dy = -54 / doc.height;
    expect(keysOf(out.doc, 't1', 'x')).toEqual([
      [CLIP_FROM + 2, Math.round((0 + dx) * 1000) / 1000],
      [CLIP_FROM + 3, Math.round((0.1 + dx) * 1000) / 1000],
      [CLIP_FROM + 4, Math.round((0.2 + dx) * 1000) / 1000]
    ]);
    expect(keysOf(out.doc, 't1', 'y')[1]).toEqual([CLIP_FROM + 3, Math.round((0.05 + dy) * 1000) / 1000]);
  });

  it('stabilises: the video moves against the point so the point stays where it was', () => {
    const doc = docWith();

    const out = applyTrack(doc, TRACK, { targetClipId: 'v1', mode: ApplyMode.Stabilise, offset: { x: 0, y: 0 } });

    if (!out.ok) {
      throw new Error(out.error);
    }
    expect(keysOf(out.doc, 'v1', 'x')).toEqual([
      [2, 0],
      [3, -0.1],
      [4, -0.2]
    ]);
    expect(keysOf(out.doc, 'v1', 'y')).toEqual([
      [2, 0],
      [3, -0.05],
      [4, -0.1]
    ]);
  });

  it('keeps the target keys outside the tracked span and replaces those inside', () => {
    const first = applyTrack(docWith(), TRACK, { targetClipId: 't1', mode: ApplyMode.Follow, offset: { x: 0, y: 0 } });
    if (!first.ok) {
      throw new Error(first.error);
    }
    const again = applyTrack(first.doc, { ...TRACK, points: TRACK.points.map((p) => ({ ...p, x: 0.9 })) }, { targetClipId: 't1', mode: ApplyMode.Follow, offset: { x: 0, y: 0 } });
    if (!again.ok) {
      throw new Error(again.error);
    }

    expect(keysOf(again.doc, 't1', 'x')).toHaveLength(3);
    expect(keysOf(again.doc, 't1', 'x')[0][1]).toBe(0.4);
  });

  it('says why when the target or the source clip is missing', () => {
    const doc = docWith();

    expect(applyTrack(doc, TRACK, { targetClipId: 'nope', mode: ApplyMode.Follow, offset: { x: 0, y: 0 } })).toEqual({ ok: false, error: 'no clip nope' });
    expect(applyTrack(doc, { ...TRACK, clipId: 'gone' }, { targetClipId: 't1', mode: ApplyMode.Follow, offset: { x: 0, y: 0 } })).toEqual({ ok: false, error: 'no clip gone' });
  });
});
