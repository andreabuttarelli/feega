import type { FrameEditSession } from '$lib/motion/frame-edit-session.svelte';
import type { BrandTokens } from '@feega/motion-core/motion/brand';
import type { FrameExtras } from '$lib/canvas/frame-extras.svelte';
import { docMode, type DocMode } from '@feega/motion-core/motion/doc';
import type { SelectionActionId } from '$lib/canvas/selection-actions';
import type { ElementHost } from '$lib/motion/element-host';
import type { Flip } from '$lib/motion/layer-props';
import type { Edge } from '$lib/motion/space';
import type { ExportRow } from '$lib/motion/export-rows';
import { FramePanel } from '$lib/canvas/motion-node';
import { estimatedText, type TextMeasure } from '@feega/motion-core/motion/layout/text-extent';

const BAR_SELECTOR = '[data-testid="right-bar"]';
export const UNNAMED_FRAME = 'Frame';
const TEXT_FIELDS = new Set(['TEXTAREA', 'INPUT']);

export type NodePlace = { x: number; y: number; w: number; h: number; rotation: number; set: (x: number, y: number) => void; resize: (w: number, h: number) => void; turn: (degrees: number) => void; flip: (flip: Flip) => void; align: ((edge: Edge) => void) | null };

export type ExportMade = { url: string; name: string; files: string[]; skipped?: string[] };

export type OpenFrame = { nodeId: string; selection: string[]; playhead: number; mode: DocMode };

export class FrameProperties {
  nodeId = $state<string | null>(null);
  session = $state.raw<FrameEditSession | null>(null);
  tokens = $state.raw<BrandTokens | null>(null);
  extras = $state.raw<FrameExtras | null>(null);
  name = $state(UNNAMED_FRAME);
  part = $state<string | null>(null);
  exportPicks: (() => void) | null = null;
  exportRows = $state.raw<((rows: ExportRow[]) => Promise<ExportMade | string>) | null>(null);
  runAction = $state.raw<((id: SelectionActionId) => void) | null>(null);
  place = $state.raw<NodePlace | null>(null);
  rename = $state.raw<((name: string) => void) | null>(null);
  host = $state.raw<ElementHost | null>(null);
  editingFill = $state<number | null>(null);
  panel = $state(FramePanel.Frame);
  measure = $state.raw<TextMeasure>(estimatedText);
  #fillOwner: string | null = null;

  publish(nodeId: string, session: FrameEditSession, tokens: BrandTokens, extras: FrameExtras | null) {
    if (nodeId !== this.#fillOwner) {
      this.editingFill = null;
      this.#fillOwner = nodeId;
    }
    this.nodeId = nodeId;
    this.session = session;
    this.tokens = tokens;
    this.extras = extras;
  }

  get routed(): string | null {
    if (!this.nodeId || !this.session) {
      return null;
    }
    const picked = this.session.selection.join(',');
    return picked ? `${this.nodeId}:${picked}` : this.nodeId;
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
    this.name = UNNAMED_FRAME;
    this.part = null;
    this.exportPicks = null;
    this.exportRows = null;
    this.runAction = null;
    this.place = null;
    this.rename = null;
    this.host = null;
    this.panel = FramePanel.Frame;
    this.measure = estimatedText;
  }
}

export const frameProperties = new FrameProperties();

export function typingInBar(focused: Element | null): boolean {
  if (!focused || !TEXT_FIELDS.has(focused.tagName) || !focused.closest(BAR_SELECTOR)) {
    return false;
  }
  return (focused as HTMLTextAreaElement | HTMLInputElement).value.length > 0;
}
