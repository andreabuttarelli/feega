const TARGET_FPS = 90;
const MS_PER_S = 1000;
const MAX_OVER_SHARE = 0.02;

export const FRAME_BUDGET_MS = MS_PER_S / TARGET_FPS;

const round = (n: number) => Math.round(n * 10) / 10;

const at = (sorted: number[], share: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0;

export function budgetOf(gaps: number[]) {
  const sorted = [...gaps].sort((a, b) => a - b);
  const p95 = round(at(sorted, 0.95));
  const over = sorted.filter((g) => g > FRAME_BUDGET_MS).length;
  const share = sorted.length ? over / sorted.length : 1;
  return { frames: sorted.length, p95, p99: round(at(sorted, 0.99)), worst: round(sorted.at(-1) ?? 0), over, overShare: round(share * 100) / 100, passed: sorted.length > 0 && p95 <= FRAME_BUDGET_MS && share <= MAX_OVER_SHARE };
}

const EDIT_TARGET_FPS = 60;
const EDIT_GOAL_FPS = 120;

export const EDIT_BUDGET_MS = MS_PER_S / EDIT_TARGET_FPS;

export const EDIT_GOAL_MS = MS_PER_S / EDIT_GOAL_FPS;

export function editBudgetOf(waits: number[]) {
  const sorted = [...waits].sort((a, b) => a - b);
  const p95 = round(at(sorted, 0.95));
  return { edits: sorted.length, p50: round(at(sorted, 0.5)), p95, worst: round(sorted.at(-1) ?? 0), atGoal: sorted.length > 0 && p95 <= EDIT_GOAL_MS, passed: sorted.length > 0 && p95 <= EDIT_BUDGET_MS };
}
