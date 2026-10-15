export const SMOKE_CAP_USD = 1;

export type SmokeCase = { provider: string; maxUsd: number };

export type BudgetVerdict = { ok: true } | { ok: false; reason: string };

export function planFits(cases: readonly SmokeCase[], cap = SMOKE_CAP_USD): BudgetVerdict {
  const worst = cases.reduce((sum, c) => sum + c.maxUsd, 0);
  return worst <= cap ? { ok: true } : { ok: false, reason: `worst case $${worst.toFixed(3)} exceeds the $${cap} cap` };
}

export function nextFits(spentUsd: number, next: SmokeCase, cap = SMOKE_CAP_USD): BudgetVerdict {
  return spentUsd + next.maxUsd <= cap
    ? { ok: true }
    : { ok: false, reason: `spent $${spentUsd.toFixed(3)} + up to $${next.maxUsd} for ${next.provider} would pass the $${cap} cap` };
}

export function overspent(actualUsd: number | null, declared: SmokeCase): boolean {
  return actualUsd !== null && actualUsd > declared.maxUsd;
}
