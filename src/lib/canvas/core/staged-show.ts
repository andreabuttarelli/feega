import { Readiness } from '@feega/motion-core/motion/gpu-full/media';

export enum OnScreen {
  Nothing = 'nothing',
  Thumb = 'thumb'
}

export function showStaged(ready: Promise<Readiness>, held: OnScreen, show: (r: Readiness) => void): Promise<void> {
  if (held === OnScreen.Nothing) {
    show(Readiness.Partial);
  }

  return ready.then((r) => {
    if (held === OnScreen.Nothing && r === Readiness.Partial) {
      return;
    }
    show(r);
  });
}

export class VectorGate {
  #open = false;
  #seen = new Set<string>();
  #waiting: (() => void)[] = [];

  presented(id: string) {
    this.#seen.add(id);
  }

  shownOf(ids: readonly string[]): number {
    return ids.filter((id) => this.#seen.has(id)).length;
  }

  after(show: () => void) {
    if (this.#open) {
      show();
      return;
    }
    this.#waiting.push(show);
  }

  settle(onScreen: readonly string[]): boolean {
    if (this.#open || !onScreen.every((id) => this.#seen.has(id))) {
      return false;
    }
    this.#open = true;
    const waiting = this.#waiting;
    this.#waiting = [];
    waiting.forEach((show) => show());
    return true;
  }
}
