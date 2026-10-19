import { CHAT_PANEL, readChatPanelPx, writeChatPanelPx } from '$lib/shell-prefs';
import type { ChatPrefill } from './chat-prefill';
import type { StreamData } from './chat-session.svelte';

export enum BarTab {
  Chat = 'chat',
  Guide = 'guide',
  Properties = 'properties'
}

export type BarProperties = { readonly shown: boolean; onshow: (shown: boolean) => void };

export type BarBinding = {
  readonly context?: () => Record<string, unknown>;
  readonly onturnend?: () => void;
  readonly ondata?: (part: StreamData) => void;
  readonly onbusy?: (busy: boolean) => void;
  readonly properties?: BarProperties;
};

export type BarClaim = { readonly element: HTMLElement; readonly binding: BarBinding };

const SHARED_TABS = [BarTab.Chat, BarTab.Guide] as const;

export class RightBarHost {
  #claims = $state.raw<BarClaim[]>([]);
  #picked = $state<BarTab.Chat | BarTab.Guide>(BarTab.Chat);
  #asked = new WeakSet<ChatPrefill>();
  prefill = $state.raw<ChatPrefill | null>(null);
  reload = $state(0);
  propertiesPane = $state.raw<HTMLElement | null>(null);
  width = $state(readChatPanelPx());

  get active(): BarClaim | null {
    return this.#claims.at(-1) ?? null;
  }

  get tabs(): BarTab[] {
    return this.active?.binding.properties ? [...SHARED_TABS, BarTab.Properties] : [...SHARED_TABS];
  }

  get tab(): BarTab {
    return this.active?.binding.properties?.shown ? BarTab.Properties : this.#picked;
  }

  claim(element: HTMLElement, binding: BarBinding): BarClaim {
    const claim = { element, binding };
    this.#claims = [...this.#claims, claim];
    return claim;
  }

  release(claim: BarClaim) {
    this.#claims = this.#claims.filter((c) => c !== claim);
  }

  select(tab: BarTab) {
    const properties = this.active?.binding.properties;
    if (tab === BarTab.Properties) {
      properties?.onshow(true);
      return;
    }
    this.#picked = tab;
    properties?.onshow(false);
  }

  ask(prefill: ChatPrefill) {
    if (this.#asked.has(prefill)) {
      return;
    }
    this.#asked.add(prefill);
    this.prefill = prefill;
  }

  refresh() {
    this.reload++;
  }

  resize(px: number) {
    this.width = Math.min(CHAT_PANEL.MAX, Math.max(CHAT_PANEL.MIN, Math.round(px)));
  }

  keepWidth() {
    writeChatPanelPx(this.width);
  }
}

export const rightBar = new RightBarHost();

export function portalInto(node: HTMLElement, target: HTMLElement) {
  target.appendChild(node);
  return { destroy: () => node.remove() };
}

type Movable =Element & { moveBefore?: (node: Node, child: Node | null) => void };

export function moveKeepingScroll(node: HTMLElement, target: HTMLElement, offsets: ReadonlyMap<Element, number>) {
  if (node.parentElement === target) {
    return;
  }
  try {
    (target as Movable).moveBefore!(node, null);
  } catch {
    target.appendChild(node);
  }
  restoreScroll(node, offsets);
}

export function restoreScroll(node: HTMLElement, offsets: ReadonlyMap<Element, number>) {
  for (const [el, top] of offsets) {
    if (node.contains(el)) {
      el.scrollTop = top;
    }
  }
}
