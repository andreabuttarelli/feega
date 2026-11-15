export const PATCH_BUDGET_MS = 24;
export const SLOW_STRIKES = 2;
export const STRIKE_WINDOW_MS = 2000;

const frameOf = (key: string) => key.split('|')[0];

export class PatchBudget {
  readonly #now: () => number;
  readonly #warm = new Set<string>();
  readonly #strikes = new Map<string, number[]>();
  readonly #builds = new Map<string, number>();

  constructor(now: () => number = () => performance.now()) {
    this.#now = now;
  }

  built(frame: string, ms: number) {
    this.#builds.set(frame, ms);
  }

  took(key: string, ms: number) {
    if (!this.#warm.has(key)) {
      this.#warm.add(key);
      return;
    }
    if (ms <= Math.max(PATCH_BUDGET_MS, this.#builds.get(frameOf(key)) ?? 0)) {
      this.#strikes.delete(key);
      return;
    }
    this.#strikes.set(key, [...this.#recent(key), this.#now()]);
  }

  redraws(key: string): boolean {
    return this.#recent(key).length < SLOW_STRIKES;
  }

  forgetFrame(frame: string) {
    for (const held of [this.#warm, this.#strikes]) {
      [...held.keys()].filter((key) => frameOf(key) === frame).forEach((key) => held.delete(key));
    }
  }

  #recent(key: string): number[] {
    const since = this.#now() - STRIKE_WINDOW_MS;
    return (this.#strikes.get(key) ?? []).filter((at) => at >= since);
  }
}
