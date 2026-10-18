import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { diffDoc } from './doc-ops';
import { ownEdit, withDrafts } from './frame-drafts';

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

const start = (): MotionDoc => {
  const doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'a' } }, 'a'));
  return must(addClip(doc, { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'b' } }, 'b'));
};
const retext = (doc: MotionDoc, id: string, text: string): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, props: { ...c.props, text } } : c)) }))
});
const textOf = (doc: MotionDoc, id: string) => findClip(doc, id)?.clip.props.text;

describe("withDrafts: a peer's unsaved edits show, mine stay on top", () => {
  const base = { version: 3, doc: start() };

  it("shows a peer's unsaved change on another clip", () => {
    const shown = withDrafts(base, base.doc, [{ baseVersion: 3, ops: diffDoc(base.doc, retext(base.doc, 'b', 'B')) }]);
    expect([textOf(shown, 'a'), textOf(shown, 'b')]).toEqual(['a', 'B']);
  });

  it('my unsaved value wins over theirs on the same field', () => {
    const mine = retext(base.doc, 'a', 'mine');
    const shown = withDrafts(base, mine, [{ baseVersion: 3, ops: diffDoc(base.doc, retext(base.doc, 'a', 'theirs')) }]);
    expect(textOf(shown, 'a')).toBe('mine');
  });

  it('a draft on another base is not shown, and nothing changes identity', () => {
    const present = base.doc;
    expect(withDrafts(base, present, [{ baseVersion: 2, ops: diffDoc(base.doc, retext(base.doc, 'b', 'B')) }])).toBe(present);
    expect(withDrafts(base, present, [])).toBe(present);
  });
});

describe('ownEdit: an edit made on the shown doc keeps only what I changed', () => {
  it('a peer preview I was looking at does not enter my history', () => {
    const base = { version: 3, doc: start() };
    const shown = withDrafts(base, base.doc, [{ baseVersion: 3, ops: diffDoc(base.doc, retext(base.doc, 'b', 'B')) }]);
    const next = ownEdit(shown, retext(shown, 'a', 'A'), base.doc);
    expect([textOf(next, 'a'), textOf(next, 'b')]).toEqual(['A', 'b']);
  });
});
