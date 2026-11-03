type Key = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey'>;

const HOLD_MS = 5000;
const ERASE = 'Backspace';

const printable = (e: Key) => e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey;

export class TypeAhead {
  #held: string | null = null;
  #since = 0;

  hold(now: number) {
    this.#held = '';
    this.#since = now;
  }

  take(e: Key, now: number): boolean {
    if (this.#held === null) {
      return false;
    }
    if (now - this.#since > HOLD_MS || e.key === 'Escape') {
      this.#held = null;
      return false;
    }
    if (e.key === ERASE) {
      this.#held = this.#held.slice(0, -1);
      return true;
    }
    if (!printable(e)) {
      return false;
    }
    this.#held += e.key;
    return true;
  }

  release(): string {
    const held = this.#held ?? '';
    this.#held = null;
    return held;
  }
}
