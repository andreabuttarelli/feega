type Paint = (t: number) => boolean;
type Raf = (frame: (t: number) => void) => unknown;

export class FramePacer {
  readonly #paint: Paint;
  readonly #raf: Raf;
  #queued = false;

  constructor(paint: Paint, raf: Raf) {
    this.#paint = paint;
    this.#raf = raf;
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
    if (this.#paint(t)) {
      this.invalidate();
    }
  }
}
