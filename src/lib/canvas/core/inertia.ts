import type { Point } from '$lib/canvas/gpu/camera';

const VELOCITY_WINDOW_MS = 80;
const FRICTION_PER_MS = 0.995;
const REST_PX_PER_MS = 0.02;

type Sample = { at: Point; t: number };

export class Glide {
  #v: Point;

  constructor(v: Point) {
    this.#v = v;
  }

  step(dt: number): Point | null {
    if (Math.hypot(this.#v.x, this.#v.y) < REST_PX_PER_MS) {
      return null;
    }
    const d = { x: this.#v.x * dt, y: this.#v.y * dt };
    const decay = FRICTION_PER_MS ** dt;
    this.#v = { x: this.#v.x * decay, y: this.#v.y * decay };
    return d;
  }
}

export class Fling {
  #samples: Sample[] = [];

  sample(at: Point, t: number) {
    this.#samples.push({ at, t });
    this.#samples = this.#samples.filter((s) => t - s.t <= VELOCITY_WINDOW_MS);
  }

  release(t: number): Glide {
    const recent = this.#samples.filter((s) => t - s.t <= VELOCITY_WINDOW_MS);
    this.#samples = [];
    const first = recent[0];
    const last = recent[recent.length - 1];
    if (!first || last.t === first.t) {
      return new Glide({ x: 0, y: 0 });
    }
    const dt = last.t - first.t;
    return new Glide({ x: (last.at.x - first.at.x) / dt, y: (last.at.y - first.at.y) / dt });
  }
}
