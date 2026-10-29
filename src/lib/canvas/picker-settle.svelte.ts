export type Later = (task: () => void) => void;

export const whenIdle: Later = (task) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => task()) : setTimeout(task, 0));

export class PickerSettle {
  #settling = new Set<string>();
  #settled = $state(0);
  readonly #later: Later;

  constructor(later: Later = whenIdle) {
    this.#later = later;
  }

  edited(id: string) {
    if (this.#settling.has(id)) {
      return;
    }
    this.#settling.add(id);
    this.#later(() => {
      this.#settling.delete(id);
      this.#settled += 1;
    });
  }

  settling(id: string): boolean {
    void this.#settled;
    return this.#settling.has(id);
  }
}
