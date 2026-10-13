import type { MotionDoc } from '$lib/motion/doc';
import type { OpResult } from '$lib/motion/timeline';
import type { CanvasLayer } from './layers';

export type CanvasSide = {
  readonly nodes: readonly CanvasLayer[];
  readonly selected: readonly string[];
  select(ids: string[]): void;
};

export type VideoSide = {
  readonly nodeId: string;
  readonly doc: MotionDoc;
  readonly selection: readonly string[];
  select(ids: string[]): void;
  edit(result: OpResult, summary: string): void;
};

let canvas = $state.raw<CanvasSide | null>(null);
let video = $state.raw<VideoSide | null>(null);

function publisher<T>(set: (side: T | null) => void, current: () => T | null) {
  return (side: T) => {
    set(side);
    return () => {
      if (current() === side) {
        set(null);
      }
    };
  };
}

export const layersSource = {
  get canvas() {
    return canvas;
  },
  get video() {
    return video;
  },
  publishCanvas: publisher<CanvasSide>(
    (side) => (canvas = side),
    () => canvas
  ),
  publishVideo: publisher<VideoSide>(
    (side) => (video = side),
    () => video
  )
};
