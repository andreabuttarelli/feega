import type { MotionDoc } from '$lib/motion/doc';
import { branchDiff, mergeBranch, type Choices, type Conflict } from '$lib/motion/branch-merge';

export enum BranchOutcome {
  Merged = 'merged',
  Dropped = 'dropped',
  NotABranch = 'not_a_branch',
  FrameGone = 'frame_gone'
}

export type Head = { version: number; doc: MotionDoc };

export type Fork = { id: string; frameId: string; name: string; baseVersion: number };

export type BranchStore = {
  head: (nodeId: string) => Promise<Head | null>;
  revision: (nodeId: string, version: number) => Promise<MotionDoc | null>;
  fork: (frameId: string, name: string, head: Head) => Promise<string>;
  forkOf: (branchId: string) => Promise<Fork | null>;
  forks: (frameId: string) => Promise<Fork[]>;
  commit: (nodeId: string, base: Head, doc: MotionDoc) => Promise<number>;
  drop: (branchId: string) => Promise<void>;
};

export type Review = { fork: Fork; conflicts: Conflict[]; base: MotionDoc; branch: Head; main: Head };

export async function createBranch(store: BranchStore, frameId: string, name: string): Promise<string | null> {
  const head = await store.head(frameId);
  return head ? store.fork(frameId, name, head) : null;
}

export function listBranches(store: BranchStore, frameId: string): Promise<Fork[]> {
  return store.forks(frameId);
}

export async function reviewBranch(store: BranchStore, branchId: string): Promise<Review | null> {
  const fork = await store.forkOf(branchId);
  if (!fork) {
    return null;
  }
  const [base, branch, main] = await Promise.all([store.revision(fork.frameId, fork.baseVersion), store.head(branchId), store.head(fork.frameId)]);
  if (!base || !branch || !main) {
    return null;
  }
  return { fork, base, branch, main, conflicts: branchDiff(base, branch.doc, main.doc).conflicts };
}

export type Refusal = BranchOutcome.NotABranch | BranchOutcome.FrameGone;

export type Merge = { outcome: BranchOutcome.Merged; version: number } | { outcome: Refusal };

export async function mergeBranchBack(store: BranchStore, branchId: string, choices: Choices): Promise<Merge> {
  const fork = await store.forkOf(branchId);
  if (!fork) {
    return { outcome: BranchOutcome.NotABranch };
  }
  const review = await reviewBranch(store, branchId);
  if (!review) {
    return { outcome: BranchOutcome.FrameGone };
  }
  const merged = mergeBranch(review.base, review.branch.doc, review.main.doc, choices);
  const version = await store.commit(fork.frameId, review.main, merged);
  await store.drop(branchId);
  return { outcome: BranchOutcome.Merged, version };
}

export async function dropBranch(store: BranchStore, branchId: string): Promise<BranchOutcome> {
  if (!(await store.forkOf(branchId))) {
    return BranchOutcome.NotABranch;
  }
  await store.drop(branchId);
  return BranchOutcome.Dropped;
}
