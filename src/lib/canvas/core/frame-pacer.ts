type Paint = (t: number) => boolean;
type Raf = (frame: (t: number) => void) => unknown;
type Busy = () => boolean;

export class FramePacer {
  readonly #paint: Paint;
  readonly #raf: Raf;
  readonly #busy: Busy;
  #queued = false;

  constructor(paint: Paint, raf: Raf, busy: Busy = () => false) {
    this.#paint = paint;
    this.#raf = raf;
    this.#busy = busy;
  }

  invalidate() {
    if (this.#queued) {
      return;
    }
    this.#queued = true;
    this.#raf((t) => this.#frame(t));
  }

  #frame(t: number) {
    this.#queued = false;
    if (this.#busy() || this.#paint(t)) {
      this.invalidate();
    }
  }
}
