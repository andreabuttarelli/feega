import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, parseMotionDoc, type MotionDoc } from './doc';
import { addClip, setKeyframes } from './timeline';
import { Ease } from './design';
import { OpKind, applyOps, diffDoc, rebase } from './doc-ops';

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

function base(): MotionDoc {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'hello', x: 0.25, y: 0.5 } }, 'a'));
  doc = must(addClip(doc, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'world', x: 0.75, y: 0.5 } }, 'b'));
  return doc;
}

const clip = (doc: MotionDoc, id: string) => findClip(doc, id)?.clip;

const withProp = (doc: MotionDoc, id: string, key: string, value: unknown): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, props: { ...c.props, [key]: value } } : c)) }))
});

const without = (doc: MotionDoc, id: string): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== id) })) });

const valid = (doc: MotionDoc) => parseMotionDoc(doc).ok;

describe('diffing two docs into ops', () => {
  it('finds no ops between equal docs', () => {
    expect(diffDoc(base(), base())).toEqual([]);
  });

  it('names a single prop change by clip and key', () => {
    const ops = diffDoc(base(), withProp(base(), 'a', 'text', 'hi'));
    expect(ops).toEqual([{ kind: OpKind.ClipEntry, clipId: 'a', field: 'props', key: 'text', value: 'hi' }]);
  });

  it('replays to the same doc', () => {
    const before = base();
    let after = withProp(before, 'b', 'x', 0.1);
    after = without(after, 'a');
    after = must(addClip(after, { component: 'Text', from: 10, durationInFrames: 20, props: { text: 'new' } }, 'c'));
    after = { ...after, durationInFrames: 240 };
    expect(applyOps(before, diffDoc(before, after))).toEqual(after);
  });

  it('replays a reorder inside a track', () => {
    const before = base();
    const track = before.tracks[0];
    const after = { ...before, tracks: [{ ...track, clips: [...track.clips].reverse() }, ...before.tracks.slice(1)] };
    expect(applyOps(before, diffDoc(before, after))).toEqual(after);
  });

  it('survives a JSON round trip, the way ops travel', () => {
    const before = base();
    const after = { ...withProp(before, 'a', 'y', 0.9), still: undefined };
    const ops = JSON.parse(JSON.stringify(diffDoc(before, after)));
    expect(applyOps(before, ops)).toEqual(JSON.parse(JSON.stringify(after)));
  });
});

describe('rebasing my ops onto a newer head', () => {
  it('keeps both edits when they touch different clips', () => {
    const start = base();
    const mine = withProp(start, 'a', 'text', 'mine');
    const theirs = withProp(start, 'b', 'text', 'theirs');
    const merged = rebase(start, mine, theirs);
    expect(clip(merged, 'a')?.props.text).toBe('mine');
    expect(clip(merged, 'b')?.props.text).toBe('theirs');
    expect(valid(merged)).toBe(true);
  });

  it('keeps both edits when they touch different props of one clip', () => {
    const start = base();
    const merged = rebase(start, withProp(start, 'a', 'x', 0.1), withProp(start, 'a', 'y', 0.9));
    expect(clip(merged, 'a')?.props).toMatchObject({ x: 0.1, y: 0.9 });
  });

  it('keeps both animations when they key different properties of one clip', () => {
    const start = base();
    const keys = [{ frame: 0, value: 0, ease: Ease.Standard }, { frame: 30, value: 1, ease: Ease.Standard }];
    const mine = must(setKeyframes(start, 'a', 'opacity', keys));
    const theirs = must(setKeyframes(start, 'a', 'x', keys));
    const merged = rebase(start, mine, theirs);
    expect(Object.keys(clip(merged, 'a')?.keyframes ?? {}).sort()).toEqual(['opacity', 'x']);
  });

  it('lets the last writer win on the same field', () => {
    const start = base();
    const merged = rebase(start, withProp(start, 'a', 'text', 'mine'), withProp(start, 'a', 'text', 'theirs'));
    expect(clip(merged, 'a')?.props.text).toBe('mine');
  });

  it('converges: both orders agree on everything but the field both wrote', () => {
    const start = base();
    const mine = withProp(withProp(start, 'a', 'text', 'mine'), 'b', 'x', 0.2);
    const theirs = withProp(start, 'a', 'y', 0.8);
    const ab = rebase(start, theirs, rebase(start, mine, start));
    const ba = rebase(start, mine, rebase(start, theirs, start));
    expect(ab).toEqual(ba);
  });

  it('drops an edit to a clip someone else deleted', () => {
    const start = base();
    const merged = rebase(start, withProp(start, 'a', 'text', 'mine'), without(start, 'a'));
    expect(clip(merged, 'a')).toBeUndefined();
    expect(valid(merged)).toBe(true);
  });

  it('deletes a clip someone else edited', () => {
    const start = base();
    const merged = rebase(start, without(start, 'a'), withProp(start, 'a', 'text', 'theirs'));
    expect(clip(merged, 'a')).toBeUndefined();
  });

  it('keeps clips both sides added', () => {
    const start = base();
    const mine = must(addClip(start, { component: 'Text', from: 0, durationInFrames: 30, props: { text: 'm' } }, 'm'));
    const theirs = must(addClip(start, { component: 'Text', from: 0, durationInFrames: 30, props: { text: 't' } }, 't'));
    const merged = rebase(start, mine, theirs);
    expect(clip(merged, 'm')).toBeDefined();
    expect(clip(merged, 't')).toBeDefined();
  });

  it('drops a clip added to a track someone else removed', () => {
    const start = { ...base(), tracks: [...base().tracks, { id: 'v2', kind: base().tracks[0].kind, name: 'Video 2', clips: [] }] };
    const mine = { ...start, tracks: start.tracks.map((t) => (t.id === 'v2' ? { ...t, clips: [{ ...clip(start, 'a')!, id: 'z' }] } : t)) };
    const theirs = { ...start, tracks: start.tracks.filter((t) => t.id !== 'v2') };
    const merged = rebase(start, mine, theirs);
    expect(clip(merged, 'z')).toBeUndefined();
    expect(merged.tracks.map((t) => t.id)).not.toContain('v2');
  });

  it('merges doc-level fields independently', () => {
    const start = base();
    const merged = rebase(start, { ...start, durationInFrames: 300 }, { ...start, background: 'transparent' as MotionDoc['background'] });
    expect(merged.durationInFrames).toBe(300);
    expect(merged.background).toBe('transparent');
  });
});
