import { CONNECTOR_STYLE } from './connectors';
import { listLabel, type ListNode } from './list-node';
import type { OutputValue, SelectOutput } from './select-outputs';
import type { SourceView } from './source-thumbs';

export type MediaView = { url: string | null; kind: 'image' | 'video' };

export enum SelectBody {
  Unconnected = 'unconnected',
  Empty = 'empty',
  Photo = 'photo',
  PhotoMissing = 'photo-missing',
  Text = 'text'
}

export type SelectRow = { color: string; label: string; value: string; thumb: string | null; flagged: boolean };

export type SelectView = { index: number; total: number; body: SelectBody; text: string; url: string | null; rows: SelectRow[]; canAdd: boolean };

export enum BatchState {
  Pick = 'pick',
  Card = 'card',
  Failed = 'failed'
}

export type BatchView = { state: BatchState; thumbs: string[]; approved: string; rest: string; options: boolean | null };

export type NodeView = { source?: SourceView; media?: MediaView; select?: SelectView; batch?: BatchView };

const PREVIEW_CHARS = 60;
const NOTHING = '—';

type Valued = { mediaUrls: string[]; text?: string | null } | null | undefined;

function summary(value: Valued): string {
  if (!value) {
    return NOTHING;
  }
  if (value.mediaUrls.length) {
    return value.mediaUrls.length === 1 ? '1 file' : `${value.mediaUrls.length} files`;
  }
  const text = value.text?.trim() ?? '';
  return text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS)}…` : text || NOTHING;
}

function rowOf(out: SelectOutput, values: Record<string, OutputValue>): SelectRow {
  const color = CONNECTOR_STYLE[out.port].color;
  if (out.incompatible) {
    return { color, label: out.label, value: 'Not available', thumb: null, flagged: true };
  }
  const value = values[out.handle];
  return { color, label: out.label, value: summary(value), thumb: out.port === 'images' ? (value?.mediaUrls[0] ?? null) : null, flagged: false };
}

function bodyOf(list: ListNode | null, index: number): Pick<SelectView, 'body' | 'text' | 'url'> {
  const none = { text: '', url: null };
  if (!list) {
    return { body: SelectBody.Unconnected, ...none };
  }
  const current = list.items.length ? list.items[Math.min(index, list.items.length) - 1] : null;
  if (!current) {
    return { body: SelectBody.Empty, ...none };
  }
  if (list.itemKind === 'image') {
    return current.url ? { body: SelectBody.Photo, text: '', url: current.url } : { body: SelectBody.PhotoMissing, ...none };
  }
  return { body: SelectBody.Text, text: current.text ?? listLabel(current, index - 1), url: null };
}

export function selectView(index: number, list: ListNode | null, outputs: SelectOutput[], values: Record<string, OutputValue>, canAdd: boolean): SelectView {
  return { index, total: list?.items.length ?? 0, ...bodyOf(list, index), rows: outputs.map((o) => rowOf(o, values)), canAdd };
}

type BatchCounts = { approved: number; done: number; total: number; running: number; failed: number; thumbs: string[] };

export function batchOf(card: BatchCounts): BatchView {
  const running = card.running ? ` · ${card.running} running` : '';
  const failed = card.failed ? ` · ${card.failed} failed` : '';
  return { state: BatchState.Card, thumbs: card.thumbs, approved: String(card.approved), rest: ` approved · ${card.done}/${card.total} done${running}${failed}`, options: null };
}

export const unreachableBatch = (): BatchView => ({ state: BatchState.Failed, thumbs: [], approved: '', rest: '', options: null });

export const pickBatch = (options: boolean | null): BatchView => ({ state: BatchState.Pick, thumbs: [], approved: '', rest: '', options });
