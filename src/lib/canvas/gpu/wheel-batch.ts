import type { Viewport } from '../dot-grid';
import { panBy, zoomAt, type Point } from './camera';

type Step = (view: Viewport) => Viewport;

export class WheelBatch {
  #steps: Step[] = [];

  zoom(at: Point, factor: number) {
    this.#steps.push((view) => zoomAt(view, at, factor));
  }

  pan(by: Point) {
    this.#steps.push((view) => panBy(view, by));
  }

  pending(): boolean {
    return this.#steps.length > 0;
  }

  take(view: Viewport): Viewport {
    const steps = this.#steps;
    this.#steps = [];
    return steps.reduce((at, step) => step(at), view);
  }
}
