export const PATCH_BUDGET_MS = 24;

export class PatchBudget {
  readonly #slow = new Set<string>();

  took(frame: string, ms: number) {
    if (ms > PATCH_BUDGET_MS) {
      this.#slow.add(frame);
    }
  }

  redraws(frame: string): boolean {
    return !this.#slow.has(frame);
  }

  forget(frame: string) {
    this.#slow.delete(frame);
  }
}
