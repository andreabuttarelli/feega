import { describe, expect, it } from 'vitest';
import { JUNCTION, JUNCTION_KINDS, JunctionKind, Span, junctionPairs, junctionProblem, withJunctions } from './junctions';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { addClip, addTrack, setJunction } from './timeline';
import { TrackKind } from './components';
import { TransitionKind } from './design';

function ok(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const clip = (doc: MotionDoc, id: string) => doc.tracks.flatMap((t) => t.clips as MotionClip[]).find((c) => c.id === id)!;

function cut(): MotionDoc {
  let doc = { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 300 };
  doc = ok(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 90 }, 'a'));
  doc = ok(addClip(doc, { component: 'Shape', from: 90, durationInFrames: 90, trackId: doc.tracks[0].id }, 'b'));
  return ok(setKeyframesAt(doc));
}

function setKeyframesAt(doc: MotionDoc) {
  return { ok: true as const, doc: { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'b' ? { ...c, keyframes: { opacity: [{ frame: 0, value: 0, ease: 'linear' as const }] }, transitionIn: { kind: TransitionKind.Fade, durationInFrames: 10 } } : c)) })) } };
}

describe('the junction table', () => {
  it('every kind says how the clip that leaves and the clip that arrives move', () => {
    for (const kind of JUNCTION_KINDS) {
      const spec = JUNCTION[kind];
      expect({ kind, moves: spec.incoming.length + spec.outgoing.length > 0 }).toEqual({ kind, moves: true });
    }
  });

  it('dip to black darkens the first clip in the first half and lights the second in the second half', () => {
    expect(JUNCTION[JunctionKind.DipToBlack].outgoing[0]).toMatchObject({ span: Span.FirstHalf, to: { filter: 'brightness(0)' } });
    expect(JUNCTION[JunctionKind.DipToBlack].incoming.at(-1)).toMatchObject({ span: Span.SecondHalf, to: { filter: 'brightness(1)' } });
  });
});

describe('setJunction', () => {
  it('a transition sits on the clip that arrives, at the cut with the clip before it', () => {
    const doc = ok(setJunction(cut(), 'b', { kind: JunctionKind.Crossfade, durationInFrames: 12 }));

    expect(clip(doc, 'b').junction).toEqual({ kind: JunctionKind.Crossfade, durationInFrames: 12 });
    expect(junctionPairs(doc)).toEqual([{ outgoing: 'a', incoming: 'b', kind: JunctionKind.Crossfade, durationInFrames: 12 }]);
  });

  it('a clip with nothing ending where it starts has no cut to transition from', () => {
    expect(junctionProblem(cut(), 'a')).toMatch(/nothing ends/);
    expect(setJunction(cut(), 'a', { kind: JunctionKind.Crossfade, durationInFrames: 12 })).toMatchObject({ ok: false });
  });

  it('the clip before may sit on another track', () => {
    let doc = cut();
    doc = ok(addTrack(doc, TrackKind.Visual, 't2'));
    doc = ok(addClip(doc, { component: 'Shape', from: 180, durationInFrames: 60, trackId: 't2' }, 'c'));

    expect(junctionProblem(doc, 'c')).toBeNull();
  });

  it('none removes it', () => {
    const doc = ok(setJunction(ok(setJunction(cut(), 'b', { kind: JunctionKind.Blur, durationInFrames: 12 })), 'b', null));

    expect(clip(doc, 'b').junction ?? null).toBeNull();
  });
});

describe('withJunctions', () => {
  const joined = withJunctions(ok(setJunction(cut(), 'b', { kind: JunctionKind.Crossfade, durationInFrames: 12 })));

  it('the two clips overlap across the cut, half the transition on each side', () => {
    expect(clip(joined, 'a')).toMatchObject({ from: 0, durationInFrames: 96 });
    expect(clip(joined, 'b')).toMatchObject({ from: 84, durationInFrames: 96 });
  });

  it('the arriving clip keeps its animation where it was: keyframes move with the earlier start', () => {
    expect(clip(joined, 'b').keyframes.opacity[0].frame).toBe(6);
  });

  it('the transition replaces the out edge of the first clip and the in edge of the second', () => {
    expect(clip(joined, 'b').transitionIn.kind).toBe(TransitionKind.None);
    expect(clip(joined, 'a').transitionOut.kind).toBe(TransitionKind.None);
  });

  it('a doc without junctions is the same doc', () => {
    const doc = cut();
    expect(withJunctions(doc)).toBe(doc);
  });
});
