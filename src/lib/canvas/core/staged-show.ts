import { Readiness } from '@feega/motion-core/motion/gpu-full/media';

export enum OnScreen {
  Nothing = 'nothing',
  Thumb = 'thumb'
}

export enum Stage {
  Vectors = 'vectors',
  Settled = 'settled'
}

export const RETRY_MS = [1_000, 4_000, 15_000];

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function showStaged(ready: () => Promise<Readiness>, held: OnScreen, show: (r: Readiness, stage: Stage) => void, wait: (ms: number) => Promise<void> = pause): Promise<void> {
  if (held === OnScreen.Nothing) {
    show(Readiness.Partial, Stage.Vectors);
  }

  let settled = await ready();
  show(settled, Stage.Settled);
  for (const ms of RETRY_MS) {
    if (settled === Readiness.Whole) {
      return;
    }
    await wait(ms);
    settled = await ready();
    show(settled, Stage.Settled);
  }
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

export const shownBefore = ({ thumb, drawn }: { thumb: boolean; drawn: boolean }): OnScreen => (thumb || drawn ? OnScreen.Thumb : OnScreen.Nothing);
