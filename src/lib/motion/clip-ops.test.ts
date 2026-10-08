import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { ClipOp, runClipOp } from './clip-ops';

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function fixture(): MotionDoc {
  let d = newMotionDoc(MotionFormat.Square);
  d = must(addClip(d, { component: 'Title', from: 0, durationInFrames: 30, props: { text: 'One' } }, 'a'));
  d = must(addClip(d, { component: 'Title', from: 10, durationInFrames: 20, props: { text: 'Two' } }, 'b'));
  return d;
}

const ids = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips.map((c) => c.id));

let counter = 0;
const ctx = (selection: string[], frame = 15, parent: string | null = null) => ({ doc: fixture(), selection, frame, parent, newId: () => `n${++counter}` });

describe('clip ops', () => {
  it('split cuts every selected clip at the playhead, in one edit', () => {
    const done = runClipOp(ClipOp.Split, ctx(['a', 'b']));

    expect(done.ok && ids(done.doc)).toHaveLength(4);
    expect(done.ok && done.summary).toBe('Split');
  });

  it('duplicate copies the selection and selects the copies', () => {
    const done = runClipOp(ClipOp.Duplicate, ctx(['a']));

    expect(done.ok && ids(done.doc)).toHaveLength(3);
    expect(done.ok && done.selection).toHaveLength(1);
    expect(done.ok && done.selection[0]).not.toBe('a');
  });

  it('delete removes the selection and clears it', () => {
    const done = runClipOp(ClipOp.Delete, ctx(['a']));

    expect(done.ok && ids(done.doc)).toEqual(['b']);
    expect(done.ok && done.selection).toEqual([]);
  });

  it('parent sets the chosen layer as parent of the selection, none clears it', () => {
    const parented = runClipOp(ClipOp.Parent, ctx(['b'], 15, 'a'));

    expect(parented.ok && findClip(parented.doc, 'b')?.clip.parent).toBe('a');
    const cleared = parented.ok ? runClipOp(ClipOp.Parent, { ...ctx(['b']), doc: parented.doc }) : parented;
    expect(cleared.ok ? findClip(cleared.doc, 'b')?.clip.parent : 'failed').toBeNull();
  });

  it('a failing op reports its error instead of a doc', () => {
    expect(runClipOp(ClipOp.Split, ctx(['a'], 200)).ok).toBe(false);
  });
});
