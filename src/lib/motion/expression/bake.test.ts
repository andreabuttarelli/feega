import { describe, expect, it } from 'vitest';
import { Ease } from '../design';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from '../doc';
import { addClip, setKeyframes, setTransform } from '../timeline';
import { sampleTrack } from '../keyframes';
import { setCameraExpression, setExpression } from './ops';
import { bakeExpressions, expressionErrors, expressionValue, liveEvaluator } from './bake';
import { InputKey, valuesPort } from './inputs';
import { setCamera } from '../camera-ops';

function ok(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

function twoShapes(): MotionDoc {
  let doc = newMotionDoc(MotionFormat.Landscape);
  doc = ok(addClip(doc, { component: 'Shape', from: 0, durationInFrames: 60 }, 'a'));
  doc = ok(addClip(doc, { component: 'Shape', from: 30, durationInFrames: 60 }, 'b'));
  return doc;
}

describe('expressions on a doc', () => {
  it('stores an expression per property and survives a parse round trip', () => {
    const doc = ok(setExpression(twoShapes(), 'a', 'rotateZ', 'time * 360'));
    const parsed = parseMotionDoc(JSON.parse(JSON.stringify(doc)));

    expect(parsed.ok && findClip(parsed.doc, 'a')!.clip.expressions).toEqual({ rotateZ: 'time * 360' });
  });

  it('refuses a broken expression, a property the clip cannot animate, and a colour', () => {
    expect(setExpression(twoShapes(), 'a', 'rotateZ', 'time *')).toMatchObject({ ok: false });
    expect(setExpression(twoShapes(), 'a', 'orbit', 'time')).toMatchObject({ ok: false, error: expect.stringContaining('orbit') });
    expect(setExpression(twoShapes(), 'a', 'fill', 'time')).toMatchObject({ ok: false, error: expect.stringContaining('number') });
    expect(setExpression(twoShapes(), 'a', 'x', 'layer("nobody").x')).toMatchObject({ ok: false, error: expect.stringContaining('nobody') });
  });

  it('removes an expression with null', () => {
    const doc = ok(setExpression(ok(setExpression(twoShapes(), 'a', 'x', 'value')), 'a', 'x', null));
    expect(findClip(doc, 'a')!.clip.expressions).toEqual({});
  });

  it('combines with keyframes through value, in clip-local time', () => {
    let doc = ok(setKeyframes(twoShapes(), 'b', 'x', [
      { frame: 0, value: 0, ease: Ease.Linear },
      { frame: 30, value: 0.3, ease: Ease.Linear }
    ]));
    doc = ok(setExpression(doc, 'b', 'x', 'value + time'));

    expect(expressionValue(doc, 'b', 'x', 30 + 15)).toBeCloseTo(0.15 + 0.5);
  });

  it('links to another layer by id and follows it at the same frame', () => {
    let doc = ok(setKeyframes(twoShapes(), 'a', 'y', [
      { frame: 0, value: -0.5, ease: Ease.Linear },
      { frame: 60, value: 0.5, ease: Ease.Linear }
    ]));
    doc = ok(setExpression(doc, 'b', 'y', 'layer("a").y + 0.1'));

    expect(expressionValue(doc, 'b', 'y', 45)).toBeCloseTo(-0.5 + 45 / 60 + 0.1);
  });

  it('reports a cycle between layers instead of looping', () => {
    let doc = ok(setExpression(twoShapes(), 'a', 'x', 'value'));
    doc = ok(setExpression(doc, 'b', 'x', 'layer("a").x'));
    doc = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'a' ? { ...c, expressions: { x: 'layer("b").x' } } : c)) })) };

    expect(expressionErrors(doc)).toContainEqual(expect.objectContaining({ clipId: 'a', key: 'x', error: expect.stringContaining('cycle') }));
    expect(setExpression(doc, 'a', 'x', 'layer("b").x')).toMatchObject({ ok: false, error: expect.stringContaining('cycle') });
  });

  it('bakes into frame keyframes that sample to the expression, deterministically', () => {
    let doc = ok(setTransform(twoShapes(), 'a', { x: 0.1 }));
    doc = ok(setExpression(doc, 'a', 'x', 'wiggle(4, 0.05)'));
    const once = bakeExpressions(doc);
    const twice = bakeExpressions(doc);
    const track = findClip(once, 'a')!.clip.keyframes.x;

    expect(once).toEqual(twice);
    for (const frame of [0, 7, 23, 59]) {
      expect(sampleTrack(track, frame)).toBeCloseTo(expressionValue(doc, 'a', 'x', frame), 3);
    }
    expect(findClip(once, 'a')!.clip.expressions).toEqual({});
  });

  it('a linear expression bakes into two keys, not one per frame', () => {
    const doc = ok(setExpression(twoShapes(), 'a', 'rotateZ', 'time * 90'));
    const track = findClip(bakeExpressions(doc), 'a')!.clip.keyframes.rotateZ;

    expect(track).toHaveLength(2);
    expect(track[1]).toMatchObject({ frame: 60, value: 180 });
  });

  it('clamps a baked value into the property range', () => {
    const doc = ok(setExpression(twoShapes(), 'a', 'opacity', 'time * 10'));
    const track = findClip(bakeExpressions(doc), 'a')!.clip.keyframes.opacity;

    expect(Math.max(...track.map((k) => Number(k.value)))).toBe(1);
  });

  it('gives each layer its own wiggle unless a seed is passed', () => {
    let doc = ok(setExpression(twoShapes(), 'a', 'x', 'wiggle(2, 0.1)'));
    doc = ok(setExpression(doc, 'b', 'x', 'wiggle(2, 0.1)'));
    expect(expressionValue(doc, 'a', 'x', 40)).not.toBe(expressionValue(doc, 'b', 'x', 40));
  });

  it('drives the camera too: a shake on the camera bakes into camera keyframes', () => {
    let doc = ok(setCamera(twoShapes(), { base: {} }));
    doc = ok(setCameraExpression(doc, 'rotateZ', 'wiggle(6, 2)'));
    const baked = bakeExpressions(doc);

    expect(baked.camera!.keyframes.rotateZ!.length).toBeGreaterThan(10);
    expect(baked.camera!.expressions).toEqual({});
  });
});

describe('audio-reactive expressions', () => {
  const pulse = { version: 1, fps: 30, duration: 2, amp: Array.from({ length: 60 }, (_, i) => (i < 30 ? 0 : 1)), onsets: [], bpm: null, beats: [], speech: [] };

  function reactive(): MotionDoc {
    const withMusic = ok(addClip(twoShapes(), { component: 'Audio', from: 0, durationInFrames: 60, props: { assetId: 'm' } }, 'music'));
    return ok(setExpression(withMusic, 'a', 'scale', 'value * (1 + audio.amp())'));
  }

  it('bake reads the stored analysis at each frame', () => {
    const baked = bakeExpressions(reactive(), { m: pulse });
    const track = findClip(baked, 'a')!.clip.keyframes.scale;

    expect([sampleTrack(track, 10), sampleTrack(track, 40)]).toEqual([1, 2]);
    expect(expressionValue(reactive(), 'a', 'scale', 40, { m: pulse })).toBe(2);
  });

  it('without the analysis the music is silent, not an error', () => {
    expect(expressionErrors(reactive())).toEqual([]);
    expect(expressionValue(reactive(), 'a', 'scale', 40)).toBe(1);
  });

  it('bakes an input expression exactly as its defaults, so the video never depends on a cursor', () => {
    const live = ok(setExpression(ok(setExpression(twoShapes(), 'a', 'rotateY', '(input.pointer.x - 0.5) * 30 + input.tilt.x * 20')), 'a', 'x', 'value + input.scroll + input.time * 0'));
    const literal = ok(setExpression(ok(setExpression(twoShapes(), 'a', 'rotateY', '(0.5 - 0.5) * 30 + 0 * 20')), 'a', 'x', 'value + 0'));

    expect(bakeExpressions(live)).toEqual(bakeExpressions(literal));
    expect(bakeExpressions(live)).toEqual(bakeExpressions(live));
  });

  it('evaluates live with simulated inputs, per clip, and falls back to defaults when they are missing', () => {
    const doc = ok(setExpression(twoShapes(), 'a', 'rotateY', '(input.pointer.x - 0.5) * 30'));
    const moved = liveEvaluator(doc, {}, () => valuesPort({ [InputKey.PointerX]: 1 }, 0, (_s, t) => t));
    const absent = liveEvaluator(doc, {}, () => valuesPort({}, 0, (_s, t) => t));

    expect(moved.value('a', 'rotateY', 10)).toBe(15);
    expect(absent.value('a', 'rotateY', 10)).toBe(0);
    expect(absent.value('a', 'rotateY', 10)).toBe(expressionValue(doc, 'a', 'rotateY', 10));
  });

  it('forgets last frame values on reset, so a moved cursor shows at the same frame', () => {
    const doc = ok(setExpression(twoShapes(), 'a', 'rotateY', 'input.pointer.x * 10'));
    let x = 0;
    const live = liveEvaluator(doc, {}, () => valuesPort({ [InputKey.PointerX]: x }, 0, (_s, t) => t));

    expect(live.value('a', 'rotateY', 5)).toBe(0);
    x = 1;
    live.reset();
    expect(live.value('a', 'rotateY', 5)).toBe(10);
  });
});

