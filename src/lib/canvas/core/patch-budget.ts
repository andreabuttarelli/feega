export const PATCH_BUDGET_MS = 24;
export const SLOW_STRIKES = 2;
export const RETRY_AFTER = 8;

const frameOf = (key: string) => key.split('|')[0];

export class PatchBudget {
  readonly #strikes = new Map<string, number>();
  readonly #skipped = new Map<string, number>();
  readonly #builds = new Map<string, number>();

  built(frame: string, ms: number) {
    this.#builds.set(frame, ms);
  }

  took(key: string, ms: number) {
    if (ms <= Math.max(PATCH_BUDGET_MS, this.#builds.get(frameOf(key)) ?? 0)) {
      this.#strikes.delete(key);
      return;
    }
    this.#strikes.set(key, (this.#strikes.get(key) ?? 0) + 1);
  }

  redraws(key: string): boolean {
    if ((this.#strikes.get(key) ?? 0) < SLOW_STRIKES) {
      return true;
    }
    const skipped = (this.#skipped.get(key) ?? 0) + 1;
    if (skipped <= RETRY_AFTER) {
      this.#skipped.set(key, skipped);
      return false;
    }
    this.#skipped.delete(key);
    this.#strikes.set(key, SLOW_STRIKES - 1);
    return true;
  }

  forgetFrame(frame: string) {
    for (const held of [this.#strikes, this.#skipped]) {
      [...held.keys()].filter((key) => frameOf(key) === frame).forEach((key) => held.delete(key));
    }
  }
}
