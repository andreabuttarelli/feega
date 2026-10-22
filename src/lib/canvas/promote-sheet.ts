import { writable } from 'svelte/store';

export type PaidReadiness = { hasBrand: boolean; hasAdAccount: boolean; hasMedia: boolean };
export type PaidGate = 'no_brand' | 'no_ad_account' | 'no_media' | 'ready';

const PAID_GATES: Array<{ gate: Exclude<PaidGate, 'ready'>; blocked: (r: PaidReadiness) => boolean }> = [
  { gate: 'no_brand', blocked: (r) => !r.hasBrand },
  { gate: 'no_ad_account', blocked: (r) => !r.hasAdAccount },
  { gate: 'no_media', blocked: (r) => !r.hasMedia }
];

export function paidGateFor(readiness: PaidReadiness): PaidGate {
  return PAID_GATES.find((g) => g.blocked(readiness))?.gate ?? 'ready';
}

export function promotePath(nodeIds: string[]): string {
  return nodeIds.length ? `/promote?nodeIds=${nodeIds.join(',')}` : '/promote';
}

export const canvasSelection = writable<string[]>([]);
