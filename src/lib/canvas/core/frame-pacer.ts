type Paint = (t: number) => boolean;
type Raf = (frame: (t: number) => void) => unknown;
type Busy = () => boolean;
type Later = (job: () => void) => unknown;

export class FramePacer {
  readonly #paint: Paint;
  readonly #raf: Raf;
  readonly #busy: Busy;
  readonly #later: Later;
  #queued = false;
  #afterPaint: (() => void)[] = [];

  constructor(paint: Paint, raf: Raf, busy: Busy = () => false, later: Later = (job) => setTimeout(job)) {
    this.#paint = paint;
    this.#raf = raf;
    this.#busy = busy;
    this.#later = later;
  }

  invalidate() {
    if (this.#queued) {
      return;
    }
    this.#queued = true;
    this.#raf((t) => this.#frame(t));
  }

  afterPaint(job: () => void) {
    this.#afterPaint.push(job);
    this.invalidate();
  }

  #frame(t: number) {
    this.#queued = false;
    if (this.#busy()) {
      this.invalidate();
      return;
    }
    const more = this.#paint(t);
    this.#release();
    if (more) {
      this.invalidate();
    }
  }

  #release() {
    if (!this.#afterPaint.length) {
      return;
    }
    const jobs = this.#afterPaint;
    this.#afterPaint = [];
    this.#later(() => jobs.forEach((job) => job()));
  }
}
