import type { CellSize } from './canvas-layout';

export enum CardState {
  Loading = 'loading',
  Failed = 'failed'
}

export enum Badge {
  Code = 'from code',
  Edited = 'edited',
  Sample = 'sample'
}

export type Control = { name: string; kind: string; required: boolean; options?: unknown[]; default?: unknown };

export type Controls = Control[] | null;

export type MountStatus = { kind: 'ready'; size: CellSize | null; props: Record<string, unknown>; controls: Controls } | { kind: 'failed'; reason: string } | { kind: 'controls'; controls: Controls };

export const MOUNT_STATUS = 'feega:mount:status';
export const MOUNT_CONTROLS = 'feega:mount:controls';
export const REASON_MAX = 160;
const NO_REASON = 'The component could not render here';
const READY = 'ready';
const FAILED = 'failed';

export function reasonOf(raw: unknown): string {
  const line = String(raw ?? '').split('\n')[0].trim();

  return line === '' ? NO_REASON : line.length > REASON_MAX ? `${line.slice(0, REASON_MAX)}…` : line;
}

const sizeOf = (size: { width?: number; height?: number } | undefined): CellSize | null => (size && size.width && size.height ? { width: size.width, height: size.height } : null);

export function statusOf(data: { type?: string; status?: string; reason?: string; size?: { width?: number; height?: number }; props?: Record<string, unknown>; controls?: Controls } | null): MountStatus | null {
  if (data?.type === MOUNT_CONTROLS) {
    return { kind: 'controls', controls: data.controls ?? null };
  }
  if (data?.type !== MOUNT_STATUS) {
    return null;
  }
  if (data.status === READY) {
    return { kind: 'ready', size: sizeOf(data.size), props: data.props ?? {}, controls: data.controls ?? null };
  }

  return data.status === FAILED ? { kind: 'failed', reason: reasonOf(data.reason) } : null;
}

export const FAILED_TEXT = 'Needs props';
export const NOTHING_TEXT = 'Nothing to show';
const RENDERED_NOTHING = 'It rendered nothing';

export const failedTextOf = (reason: string): string => (reason === RENDERED_NOTHING ? NOTHING_TEXT : FAILED_TEXT);
