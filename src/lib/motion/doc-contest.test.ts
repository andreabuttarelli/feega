import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { contested } from './doc-contest';

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

function seen(): MotionDoc {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'title', x: 0.5, y: 0.5 } }, 'title'));
  doc = must(addClip(doc, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'caption', x: 0.5, y: 0.8 } }, 'caption'));
  return doc;
}

const retimed = (doc: MotionDoc, id: string, at: number): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, keyframes: { ...c.keyframes, opacity: [{ frame: at, value: 1 }] } } : c)) }))
});

const moved = (doc: MotionDoc, id: string, y: number): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, props: { ...c.props, y } } : c)) }))
});

describe('an agent patch against the revision it read', () => {
  it('a human retiming the clip after the agent read it is a conflict, with the human value', () => {
    const base = seen();
    const head = retimed(base, 'title', 24);
    const attempted = moved(retimed(head, 'title', 6), 'title', 0.4);

    const clash = contested(base, head, attempted);

    expect(clash.map((c) => c.id)).toEqual(['title']);
    expect((clash[0].now as { keyframes: { opacity: { frame: number }[] } }).keyframes.opacity[0].frame).toBe(24);
  });

  it('a human edit on another element does not block the agent', () => {
    const base = seen();
    const head = retimed(base, 'caption', 24);

    expect(contested(base, head, moved(head, 'title', 0.4))).toEqual([]);
  });

  it('nothing changed since the read is never a conflict', () => {
    const base = seen();

    expect(contested(base, base, moved(base, 'title', 0.4))).toEqual([]);
  });
});
