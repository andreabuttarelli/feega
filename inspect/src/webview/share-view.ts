import type { VisitorRole } from '../../../packages/share-protocol/src/frame';

const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;

export function expiryLabel(expiresAt: string | undefined, now: number = Date.now()): string {
  const end = expiresAt ? Date.parse(expiresAt) : NaN;
  if (Number.isNaN(end)) {
    return '';
  }
  const minutes = Math.round((end - now) / MINUTE_MS);
  if (minutes <= 0) {
    return 'now';
  }
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (hours === 0) {
    return `in ${rest} min`;
  }
  return rest === 0 ? `in ${hours} h` : `in ${hours} h ${rest} min`;
}

export const roleLabel = (role: string) => (role === 'editor' ? 'Editor' : 'Viewer');

export const copyLabel = (copied: boolean) => (copied ? 'Copied' : 'Copy');

export const otherRole = (role: VisitorRole): VisitorRole => (role === 'editor' ? 'viewer' : 'editor');

export const roleToggleLabel = (role: VisitorRole) => `Make ${otherRole(role)}`;
