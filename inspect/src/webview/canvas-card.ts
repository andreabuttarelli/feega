import type { PropsSample } from '../host/component-list';
import type { CellSize } from './canvas-layout';

export enum CardState {
  Loading = 'loading',
  Failed = 'failed'
}

export enum Badge {
  Code = 'from code',
  Sample = 'sample'
}

export type MountStatus = { kind: 'ready'; size: CellSize | null; props: Record<string, unknown> } | { kind: 'failed'; reason: string };

export const MOUNT_STATUS = 'feega:mount:status';
export const REASON_MAX = 160;
const NO_REASON = 'The component could not render here';
const READY = 'ready';
const FAILED = 'failed';

export function reasonOf(raw: unknown): string {
  const line = String(raw ?? '').split('\n')[0].trim();

  return line === '' ? NO_REASON : line.length > REASON_MAX ? `${line.slice(0, REASON_MAX)}…` : line;
}

const sizeOf = (size: { width?: number; height?: number } | undefined): CellSize | null => (size && size.width && size.height ? { width: size.width, height: size.height } : null);

export function statusOf(data: { type?: string; status?: string; reason?: string; size?: { width?: number; height?: number }; props?: Record<string, unknown> } | null): MountStatus | null {
  if (data?.type !== MOUNT_STATUS) {
    return null;
  }
  if (data.status === READY) {
    return { kind: 'ready', size: sizeOf(data.size), props: data.props ?? {} };
  }

  return data.status === FAILED ? { kind: 'failed', reason: reasonOf(data.reason) } : null;
}

export function badgeOf(sample: PropsSample | undefined, shown: Record<string, unknown> | undefined): Badge | null {
  if (sample) {
    return Badge.Code;
  }

  return shown && Object.keys(shown).length > 0 ? Badge.Sample : null;
}
