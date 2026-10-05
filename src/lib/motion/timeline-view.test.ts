import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc } from './doc';
import { Ease } from './design';
import { Source } from './keyframes';
import { addClip, setKeyframes, type OpResult } from './timeline';
import { feegaTrailerV2 } from './trailer-v2';
import { withParams } from './custom/params';
import { Grip, HANDLE_PX, Reveal, Snap, easePath, edgeHandles, frameAt, graphLanes, handleAt, keyLanes, stackRows, pxPerFrame, rulerTicks, snapped, timecode } from './timeline-view';

describe('timeline view', () => {
  it('at zoom 1 a second is 60 px', () => {
    expect(pxPerFrame(1) * 30).toBe(60);
    expect(frameAt(60, 1)).toBe(30);
  });

  it('labels the ruler in minutes, seconds and frames', () => {
    expect(timecode(0)).toBe('0:00.00');
    expect(timecode(95)).toBe('0:03.05');
  });

  it('ticks get denser as the zoom grows', () => {
    expect(rulerTicks(300, 4).length).toBeGreaterThan(rulerTicks(300, 1).length);
  });

  it('snaps to a whole second within a few pixels, unless snapping is off', () => {
    const doc = newMotionDoc(MotionFormat.Square);
    const input = { playhead: 0, exclude: [], zoom: 1 };

    expect(snapped(doc, 32, { ...input, snap: Snap.On })).toBe(30);
    expect(snapped(doc, 32, { ...input, snap: Snap.Off })).toBe(32);
  });

  it('snaps to a beat when beats are given', () => {
    const doc = newMotionDoc(MotionFormat.Square);
    const input = { playhead: 0, exclude: [], zoom: 1, snap: Snap.On };

    expect(snapped(doc, 46, { ...input, beats: [45] })).toBe(45);
  });

  it('the end edge of a clip under a later overlapping clip can still be grabbed', () => {
    const kicker = { id: 'k', from: 0, durationInFrames: 90 };
    const title = { id: 't', from: 24, durationInFrames: 90 };
    const handles = edgeHandles([kicker, title], 3);

    expect(handleAt(handles, 90 * 3 - 2)).toMatchObject({ clipId: 'k', grip: Grip.End });
    expect(handleAt(handles, 24 * 3 + 2)).toMatchObject({ clipId: 't', grip: Grip.Start });
    expect(handleAt(handles, 50 * 3)).toBeNull();
  });

  it('two touching clips split the seam: left of it trims the first, right of it the second', () => {
    const handles = edgeHandles(
      [
        { id: 'a', from: 0, durationInFrames: 30 },
        { id: 'b', from: 30, durationInFrames: 30 }
      ],
      3
    );

    expect(handleAt(handles, 90 - 1)).toMatchObject({ clipId: 'a', grip: Grip.End });
    expect(handleAt(handles, 90 + 1)).toMatchObject({ clipId: 'b', grip: Grip.Start });
  });

  it('two clips ending on the same frame: the selected one owns the shared edge', () => {
    const clips = [
      { id: 'k', from: 0, durationInFrames: 90 },
      { id: 't', from: 24, durationInFrames: 66 }
    ];

    expect(handleAt(edgeHandles(clips, 3, ['k']), 90 * 3 - 2)).toMatchObject({ clipId: 'k', grip: Grip.End });
    expect(handleAt(edgeHandles(clips, 3, ['t']), 90 * 3 - 2)).toMatchObject({ clipId: 't', grip: Grip.End });
  });

  it('clips overlapping in time on one track stack in rows, so none hides another', () => {
    const rows = stackRows([
      { id: 'k', from: 9, durationInFrames: 90 },
      { id: 't', from: 11, durationInFrames: 88 },
      { id: 'next', from: 99, durationInFrames: 30 }
    ]);

    expect(rows).toEqual({ k: 0, t: 1, next: 0 });
  });

  it('a tiny clip keeps a body to drag between its two edges', () => {
    const [start, end] = edgeHandles([{ id: 'a', from: 0, durationInFrames: 3 }], 3);

    expect(start.width).toBeLessThan(HANDLE_PX);
    expect(start.left + start.width).toBeLessThan(end.left);
  });
});

describe('keyframe lanes', () => {
  const must = (r: OpResult) => {
    if (!r.ok) {
      throw new Error(r.error);
    }
    return r.doc;
  };
  const doc = must(addClip(newMotionDoc(MotionFormat.Square), { component: 'Title', from: 0 }, 't'));
  const keyed = must(
    setKeyframes(must(setKeyframes(doc, 't', 'color', [{ frame: 4, value: '#ffffff', ease: Ease.Linear }])), 't', 'rotateX', [
      { frame: 0, value: 0, ease: Ease.Linear },
      { frame: 10, value: 5, ease: Ease.Linear }
    ])
  );

  it('one lane per animated prop, in the order the component lists them, with its label', () => {
    expect(keyLanes(findClip(keyed, 't')!.clip)).toEqual([
      { prop: 'rotateX', label: 'Rotate X', source: Source.Transform, frames: [0, 10] },
      { prop: 'color', label: 'Colour', source: Source.Prop, frames: [4] }
    ]);
  });

  it('a clip without keyframes has no lanes', () => {
    expect(keyLanes(findClip(doc, 't')!.clip)).toEqual([]);
  });

  it('P S R T show their property lane even with no keyframes, U the animated ones', () => {
    const clip = findClip(keyed, 't')!.clip;
    const props = (reveal: Reveal) => keyLanes(clip, reveal).map((l) => l.prop);

    expect(props(Reveal.Position)).toEqual(['x', 'y']);
    expect(props(Reveal.Scale)).toEqual(['scale']);
    expect(props(Reveal.Rotation)).toEqual(['rotateZ']);
    expect(props(Reveal.Opacity)).toEqual(['opacity']);
    expect(props(Reveal.Animated)).toEqual(['rotateX', 'color']);
    expect(keyLanes(clip, Reveal.Opacity)[0]).toEqual({ prop: 'opacity', label: 'Opacity', source: Source.Transform, frames: [] });
  });

  it('the trailer bar with an animated Scale Y has a lane and a graph curve when selected', () => {
    const trailer = feegaTrailerV2(MotionFormat.Vertical, { imageId: null, modelId: null, voiceId: null, musicId: null } as never);
    const bar = findClip(trailer, 'bar-0')!.clip;

    expect(keyLanes(withParams(trailer, bar)).map((l) => l.prop)).toContain('scaleY');
    expect(graphLanes(trailer, ['bar-0'], [], false).map((l) => l.prop)).toContain('scaleY');
  });

  it('keyframes picked on another clip do not hide the selected clip curves', () => {
    const trailer = feegaTrailerV2(MotionFormat.Vertical, { imageId: null, modelId: null, voiceId: null, musicId: null } as never);
    const stale = [{ clipId: 'gone', prop: 'opacity', frame: 0 }];

    expect(graphLanes(trailer, ['bar-0'], stale, false).map((l) => l.prop)).toContain('scaleY');
  });

  it('the ease preview is a path from the bottom-left to the top-right corner', () => {
    const path = easePath(Ease.Linear, 40);

    expect(path.startsWith('M0,40')).toBe(true);
    expect(path.endsWith('L40,0')).toBe(true);
  });
});

describe('timeline view at another frame rate', () => {
  it('a second keeps its width and its timecode at 60 fps', () => {
    expect(pxPerFrame(1, 60) * 60).toBe(60);
    expect(frameAt(60, 1, 60)).toBe(60);
    expect(timecode(90, 60)).toBe('0:01.30');
    expect(rulerTicks(120, 1, 60).at(-1)?.frame).toBe(120);
  });
});
