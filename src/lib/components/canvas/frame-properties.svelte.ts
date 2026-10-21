import type { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
import type { BrandTokens } from '$lib/motion/brand';
import type { FrameExtras } from '$lib/canvas/frame-extras.svelte';

const BAR_SELECTOR = '[data-testid="right-bar"]';
const TEXT_FIELDS = new Set(['TEXTAREA', 'INPUT']);

export class FrameProperties {
  session = $state.raw<FrameEditSession | null>(null);
  tokens = $state.raw<BrandTokens | null>(null);
  extras = $state.raw<FrameExtras | null>(null);

  publish(session: FrameEditSession, tokens: BrandTokens, extras: FrameExtras | null) {
    this.session = session;
    this.tokens = tokens;
    this.extras = extras;
  }

  clear() {
    this.session = null;
    this.tokens = null;
    this.extras = null;
  }
}

export const frameProperties = new FrameProperties();

export function typingInBar(focused: Element | null): boolean {
  if (!focused || !TEXT_FIELDS.has(focused.tagName) || !focused.closest(BAR_SELECTOR)) {
    return false;
  }
  return (focused as HTMLTextAreaElement | HTMLInputElement).value.length > 0;
}
