export const REVEAL_WAIT_MS = 1500;

export function revealIn(missing: number, elapsedMs: number): number {
  return missing === 0 ? 0 : Math.max(0, REVEAL_WAIT_MS - elapsedMs);
}
