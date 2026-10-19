import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { Side } from '$lib/motion/branch-merge';
import { BranchOutcome, createBranch, dropBranch, listBranches, mergeBranchBack, reviewBranch, type BranchStore, type Fork } from './branches';

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

function memory(): BranchStore & { revisions: Map<string, MotionDoc[]>; dropped: string[] } {
  const revisions = new Map<string, MotionDoc[]>([['frame', [start()]]]);
  const forks = new Map<string, Fork>();
  const dropped: string[] = [];
  let next = 0;
  return {
    revisions,
    dropped,
    head: async (nodeId) => {
      const line = revisions.get(nodeId) ?? [];
      return line.length ? { version: line.length, doc: line[line.length - 1] } : null;
    },
    revision: async (nodeId, version) => revisions.get(nodeId)?.[version - 1] ?? null,
    fork: async (frameId, name, head) => {
      const id = `branch-${++next}`;
      revisions.set(id, [head.doc]);
      forks.set(id, { id, frameId, name, baseVersion: head.version });
      return id;
    },
    forkOf: async (branchId) => forks.get(branchId) ?? null,
    forks: async (frameId) => [...forks.values()].filter((f) => f.frameId === frameId && !dropped.includes(f.id)),
    commit: async (nodeId, base, doc) => {
      const line = revisions.get(nodeId)!;
      line.push(doc);
      return line.length;
    },
    drop: async (branchId) => void dropped.push(branchId)
  };
}

describe('frame branches', () => {
  it('a branch starts as a copy of the frame and is listed under it', async () => {
    const store = memory();
    const id = await createBranch(store, 'frame', 'try a title');

    expect(textOf(store.revisions.get(id!)![0], 'a')).toBe('a');
    expect((await listBranches(store, 'frame')).map((b) => b.name)).toEqual(['try a title']);
  });

  it('review shows the conflicts between what the branch and the frame changed', async () => {
    const store = memory();
    const id = (await createBranch(store, 'frame', 'b1'))!;
    store.revisions.get(id)!.push(retext(start(), 'a', 'branch'));
    store.revisions.get('frame')!.push(retext(start(), 'a', 'main'));

    const review = await reviewBranch(store, id);

    expect(review?.conflicts.map((c) => c.path)).toEqual(['clip:a:props:text']);
  });

  it('merge applies the chosen side on the frame and closes the branch', async () => {
    const store = memory();
    const id = (await createBranch(store, 'frame', 'b1'))!;
    store.revisions.get(id)!.push(retext(retext(start(), 'a', 'branch'), 'b', 'B'));
    store.revisions.get('frame')!.push(retext(start(), 'a', 'main'));

    const out = await mergeBranchBack(store, id, { 'clip:a:props:text': Side.Branch });

    expect(out.outcome).toBe(BranchOutcome.Merged);
    const head = await store.head('frame');
    expect([textOf(head!.doc, 'a'), textOf(head!.doc, 'b')]).toEqual(['branch', 'B']);
    expect(store.dropped).toEqual([id]);
  });

  it('a node that is not a branch cannot be merged', async () => {
    expect((await mergeBranchBack(memory(), 'frame', {})).outcome).toBe(BranchOutcome.NotABranch);
  });

  it('dropping refuses anything that is not a branch, so a frame is never deleted by it', async () => {
    const store = memory();
    expect(await dropBranch(store, 'frame')).toBe(BranchOutcome.NotABranch);
    expect(store.dropped).toEqual([]);
  });
});
