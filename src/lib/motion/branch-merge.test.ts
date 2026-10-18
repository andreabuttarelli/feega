import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from './doc';
import { addClip } from './timeline';
import { Side, branchDiff, mergeBranch } from './branch-merge';

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
const without = (doc: MotionDoc, id: string): MotionDoc => ({ ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== id) })) });
const textOf = (doc: MotionDoc, id: string) => findClip(doc, id)?.clip.props.text;

describe('branchDiff', () => {
  it('edits to different fields merge without a conflict', () => {
    const base = start();
    expect(branchDiff(base, retext(base, 'a', 'A'), retext(base, 'b', 'B')).conflicts).toEqual([]);
  });

  it('the same field changed to different values is one conflict, with both values', () => {
    const base = start();
    const { conflicts } = branchDiff(base, retext(base, 'a', 'branch'), retext(base, 'a', 'main'));
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ path: 'clip:a:props:text', branch: 'branch', main: 'main' });
  });

  it('the same change on both sides is not a conflict', () => {
    const base = start();
    expect(branchDiff(base, retext(base, 'a', 'same'), retext(base, 'a', 'same')).conflicts).toEqual([]);
  });

  it('deleted on one side, edited on the other, is a conflict on the clip itself', () => {
    const base = start();
    const { conflicts } = branchDiff(base, retext(base, 'a', 'edited'), without(base, 'a'));
    expect(conflicts.map((c) => c.path)).toEqual(['exists:clip:a']);
  });
});

describe('mergeBranch', () => {
  it('takes both sides where they do not overlap', () => {
    const base = start();
    const merged = mergeBranch(base, retext(base, 'a', 'A'), retext(base, 'b', 'B'), {});
    expect([textOf(merged, 'a'), textOf(merged, 'b')]).toEqual(['A', 'B']);
  });

  it('a conflict keeps main unless the branch is chosen', () => {
    const base = start();
    const branch = retext(base, 'a', 'branch');
    const main = retext(base, 'a', 'main');
    expect(textOf(mergeBranch(base, branch, main, {}), 'a')).toBe('main');
    expect(textOf(mergeBranch(base, branch, main, { 'clip:a:props:text': Side.Branch }), 'a')).toBe('branch');
  });

  it('choosing the branch over a deletion on main brings the edited clip back', () => {
    const base = start();
    const merged = mergeBranch(base, retext(base, 'a', 'edited'), without(base, 'a'), { 'exists:clip:a': Side.Branch });
    expect(textOf(merged, 'a')).toBe('edited');
  });

  it('choosing main over a deletion on main leaves it deleted', () => {
    const base = start();
    expect(findClip(mergeBranch(base, retext(base, 'a', 'edited'), without(base, 'a'), {}), 'a')).toBeNull();
  });

  it('a deletion on the branch is applied when main did not touch the clip', () => {
    const base = start();
    expect(findClip(mergeBranch(base, without(base, 'a'), retext(base, 'b', 'B'), {}), 'a')).toBeNull();
  });
});
