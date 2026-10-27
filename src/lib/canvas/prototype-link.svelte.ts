import type { LinkDraft } from '$lib/motion/prototype/link-draft';

export type LinkTarget = { id: string; name: string };

export class PrototypeLinkSession {
  targets = $state<LinkTarget[]>([]);
  draft = $state<LinkDraft | null>(null);

  aim(draft: LinkDraft) {
    this.draft = draft;
  }

  stop() {
    this.draft = null;
  }
}

export const prototypeLink = new PrototypeLinkSession();
