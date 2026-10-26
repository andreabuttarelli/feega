import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { Ease } from '@feega/motion-core/motion/design';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { composeHtml } from '@feega/motion-core/motion/hyperframes/compose';
import { duplicateKeyframes, setLaneMuted, addClip, setKeyframes, type KeyRef, type OpResult } from '@feega/motion-core/motion/timeline';
import { marqueeHits, relatedSelection } from './timeline-select';
import { withoutMutedLanes } from '@feega/motion-core/motion/playback';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

const key = (frame: number, value: number) => ({ frame, value, ease: Ease.Linear });

const keyed = () => {
  const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 120 }, 's'));
  const withOpacity = must(setKeyframes(base, 's', 'opacity', [key(0, 0), key(30, 1), key(60, 0.5)]));
  return must(setKeyframes(withOpacity, 's', 'x', [key(0, 0), key(60, 0.2)]));
};

const ref = (prop: string, frame: number): KeyRef => ({ clipId: 's', prop, frame });

describe('muting an animation lane', () => {
  it('flags the lane, and unflags it', () => {
    const muted = must(setLaneMuted(keyed(), 's', 'opacity', true));

    expect(findClip(muted, 's')!.clip.mutedLanes).toEqual(['opacity']);
    expect(findClip(must(setLaneMuted(muted, 's', 'opacity', false)), 's')!.clip.mutedLanes).toBeUndefined();
  });

  it('refuses a lane that has no keyframes', () => {
    expect(setLaneMuted(keyed(), 's', 'blur', true).ok).toBe(false);
  });

  it('playback ignores a muted lane and keeps the others; the document keeps its keys', () => {
    const muted = must(setLaneMuted(keyed(), 's', 'opacity', true));
    const played = findClip(withoutMutedLanes(muted), 's')!.clip;

    expect(Object.keys(played.keyframes)).toEqual(['x']);
    expect(Object.keys(findClip(muted, 's')!.clip.keyframes)).toEqual(['opacity', 'x']);
  });

  it('the export draws a muted lane like one that was never keyed', () => {
    const muted = must(setLaneMuted(keyed(), 's', 'opacity', true));
    const bare = must(setKeyframes(keyed(), 's', 'opacity', []));
    const html = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {} });

    expect(html(muted)).not.toEqual(html(keyed()));
    expect(html(muted)).toEqual(html({ ...bare, tracks: bare.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, keyframes: { x: c.keyframes.x } })) })) }));
  });
});

describe('duplicateKeyframes', () => {
  it('copies the selected keys after the last selected one, keeping their spacing', () => {
    const doc = must(duplicateKeyframes(keyed(), [ref('opacity', 0), ref('opacity', 30)]));
    const frames = findClip(doc, 's')!.clip.keyframes.opacity.map((k) => [k.frame, k.value]);

    expect(frames).toEqual([
      [0, 0],
      [30, 1],
      [45, 0],
      [60, 0.5],
      [75, 1]
    ]);
  });

  it('copies a single key a beat after itself', () => {
    const doc = must(duplicateKeyframes(keyed(), [ref('x', 60)]));

    expect(findClip(doc, 's')!.clip.keyframes.x.map((k) => k.frame)).toEqual([0, 60, 75]);
  });
});

describe('relatedSelection', () => {
  it('a selected layer selects its keyframes', () => {
    const out = relatedSelection(keyed(), { layers: ['s'], keys: [] });

    expect(out.layers).toEqual([]);
    expect(out.keys).toHaveLength(5);
  });

  it('selected keyframes select their layer', () => {
    const out = relatedSelection(keyed(), { layers: [], keys: [ref('x', 0)] });

    expect(out).toEqual({ layers: ['s'], keys: [] });
  });

  it('nothing selected stays nothing', () => {
    expect(relatedSelection(keyed(), { layers: [], keys: [] })).toEqual({ layers: [], keys: [] });
  });
});

describe('marqueeHits', () => {
  const items = [
    { ref: ref('opacity', 0), box: { left: 10, top: 10, right: 18, bottom: 18 } },
    { ref: ref('opacity', 30), box: { left: 100, top: 10, right: 108, bottom: 18 } },
    { ref: ref('x', 30), box: { left: 100, top: 40, right: 108, bottom: 48 } }
  ];

  it('picks the keys the rectangle touches, whichever way it was dragged', () => {
    const hits = marqueeHits({ left: 120, top: 30, right: 5, bottom: 2 }, items);

    expect(hits.map((h) => h.frame)).toEqual([0, 30]);
    expect(hits.every((h) => h.prop === 'opacity')).toBe(true);
  });

  it('picks nothing from an empty rectangle', () => {
    expect(marqueeHits({ left: 200, top: 200, right: 300, bottom: 300 }, items)).toEqual([]);
  });
});
