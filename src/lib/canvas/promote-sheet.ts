import { writable } from 'svelte/store';

export const PROMOTE_TABS = [
  { id: 'organic', label: 'Organic post' },
  { id: 'paid', label: 'Paid ad' }
] as const;
export type PromoteTab = (typeof PROMOTE_TABS)[number]['id'];

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

export function tabFromQuery(raw: string | null): PromoteTab {
  return PROMOTE_TABS.find((t) => t.id === raw)?.id ?? 'organic';
}

export function promotePath(nodeIds: string[], tab?: PromoteTab): string {
  const query = new URLSearchParams();
  if (nodeIds.length) {
    query.set('nodeIds', nodeIds.join(','));
  }
  if (tab) {
    query.set('tab', tab);
  }
  const qs = query.toString().replace(/%2C/g, ',');
  return qs ? `/promote?${qs}` : '/promote';
}

export const canvasSelection = writable<string[]>([]);
