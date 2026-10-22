import type { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
import type { BrandTokens } from '$lib/motion/brand';
import type { FrameExtras } from '$lib/canvas/frame-extras.svelte';
import { docMode, type DocMode } from '$lib/motion/doc';

const BAR_SELECTOR = '[data-testid="right-bar"]';
const TEXT_FIELDS = new Set(['TEXTAREA', 'INPUT']);

export type OpenFrame = { nodeId: string; selection: string[]; playhead: number; mode: DocMode };

export class FrameProperties {
  nodeId = $state<string | null>(null);
  session = $state.raw<FrameEditSession | null>(null);
  tokens = $state.raw<BrandTokens | null>(null);
  extras = $state.raw<FrameExtras | null>(null);
  part = $state<string | null>(null);

  publish(nodeId: string, session: FrameEditSession, tokens: BrandTokens, extras: FrameExtras | null) {
    this.nodeId = nodeId;
    this.session = session;
    this.tokens = tokens;
    this.extras = extras;
  }

  openFrame(): OpenFrame | null {
    if (!this.nodeId || !this.session) {
      return null;
    }
    return { nodeId: this.nodeId, selection: [...this.session.selection], playhead: 0, mode: docMode(this.session.history.present) };
  }

  clear() {
    this.nodeId = null;
    this.session = null;
    this.tokens = null;
    this.extras = null;
    this.part = null;
  }
}

export const frameProperties = new FrameProperties();

export function typingInBar(focused: Element | null): boolean {
  if (!focused || !TEXT_FIELDS.has(focused.tagName) || !focused.closest(BAR_SELECTOR)) {
    return false;
  }
  return (focused as HTMLTextAreaElement | HTMLInputElement).value.length > 0;
}
