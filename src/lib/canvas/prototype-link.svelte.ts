import type { MotionDoc } from '@feega/motion-core/motion/doc';
import type { LinkDraft } from '$lib/motion/prototype/link-draft';

export type LinkTarget = { id: string; name: string };

export class PrototypeLinkSession {
  targets = $state<LinkTarget[]>([]);
  docs = $state.raw<ReadonlyMap<string, MotionDoc>>(new Map());
  draft = $state<LinkDraft | null>(null);

  aim(draft: LinkDraft) {
    this.draft = draft;
  }

  stop() {
    this.draft = null;
  }
}

export const prototypeLink = new PrototypeLinkSession();
