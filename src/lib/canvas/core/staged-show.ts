import { Readiness } from '@feega/motion-core/motion/gpu-full/media';

export enum OnScreen {
  Nothing = 'nothing',
  Thumb = 'thumb',
  Poster = 'poster'
}

export enum Stage {
  Vectors = 'vectors',
  Settled = 'settled'
}

export const RETRY_MS = [1_000, 4_000, 15_000];

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Shows = { vectors: boolean; partial: (last: boolean) => boolean };

const SHOWS: Record<OnScreen, Shows> = {
  [OnScreen.Nothing]: { vectors: true, partial: () => true },
  [OnScreen.Thumb]: { vectors: false, partial: () => true },
  [OnScreen.Poster]: { vectors: false, partial: (last) => last }
};

export async function showStaged(ready: () => Promise<Readiness>, held: OnScreen, show: (r: Readiness, stage: Stage) => void, wait: (ms: number) => Promise<void> = pause): Promise<void> {
  const shows = SHOWS[held];
  if (shows.vectors) {
    show(Readiness.Partial, Stage.Vectors);
  }

  for (let attempt = 0; ; attempt++) {
    const settled = await ready();
    const last = attempt === RETRY_MS.length;
    if (settled === Readiness.Whole || shows.partial(last)) {
      show(settled, Stage.Settled);
    }
    if (settled === Readiness.Whole || last) {
      return;
    }
    await wait(RETRY_MS[attempt]);
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

export const shownBefore = ({ thumb, drawn, poster = false }: { thumb: boolean; drawn: boolean; poster?: boolean }): OnScreen => (thumb || drawn ? OnScreen.Thumb : poster ? OnScreen.Poster : OnScreen.Nothing);
