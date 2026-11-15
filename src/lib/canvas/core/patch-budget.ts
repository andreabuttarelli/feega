export const PATCH_BUDGET_MS = 24;

const frameOf = (key: string) => key.split('|')[0];

export class PatchBudget {
  readonly #slow = new Set<string>();
  readonly #builds = new Map<string, number>();

  built(frame: string, ms: number) {
    this.#builds.set(frame, ms);
  }

  took(key: string, ms: number) {
    if (ms > Math.max(PATCH_BUDGET_MS, this.#builds.get(frameOf(key)) ?? 0)) {
      this.#slow.add(key);
    }
  }

  redraws(key: string): boolean {
    return !this.#slow.has(key);
  }

  forgetFrame(frame: string) {
    [...this.#slow].filter((key) => frameOf(key) === frame).forEach((key) => this.#slow.delete(key));
  }
}
