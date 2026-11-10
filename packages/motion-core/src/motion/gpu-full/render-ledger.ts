import type { Stats } from './render-wire';

const MAX_IN_FLIGHT = 2;
const UNANSWERED: Stats = { outcome: 'reused', pending: true, cacheBytes: 0, pictureBytes: 0, scratchBytes: 0, wasmBytes: 0, lost: false, busy: false };

export class FrameLedger {
  #sent = 0;
  #acked = 0;
  #stats = UNANSWERED;

  sent() {
    this.#sent++;
  }

  answered(frames: number, stats: Stats) {
    this.#acked += frames;
    this.#stats = stats.outcome ? stats : { ...stats, outcome: this.#stats.outcome };
  }

  lost() {
    this.#stats = { ...this.#stats, lost: true };
  }

  stats(): Stats {
    return this.#stats;
  }

  pending(): boolean {
    return this.#stats.pending || this.#sent > this.#acked;
  }

  busy(): boolean {
    return this.#sent - this.#acked >= MAX_IN_FLIGHT || this.#stats.busy;
  }
}

export class AttachGate<T> {
  #held: T[] = [];
  #open = false;

  offer(work: T, run: (work: T) => void) {
    if (!this.#open) {
      this.#held.push(work);
      return;
    }
    run(work);
  }

  open(run: (work: T) => void) {
    this.#open = true;
    this.#held.splice(0).forEach(run);
  }

  close() {
    this.#open = false;
  }
}
