import type { MotionDoc } from '$lib/motion/doc';
import type { EditMode } from '$lib/motion/edit-mode';
import type { OpResult } from '$lib/motion/timeline';
import type { CanvasLayer, LayerHover } from './layers';

export type CanvasSide = {
  readonly nodes: readonly CanvasLayer[];
  readonly selected: readonly string[];
  readonly outlinesUrl: string;
  previewUrl(nodeId: string): string;
  select(ids: string[]): void;
  open(nodeId: string): void;
};

export type VideoSide = {
  readonly nodeId: string;
  readonly doc: MotionDoc;
  readonly selection: readonly string[];
  readonly parts: Record<string, readonly string[]>;
  readonly part: string | null;
  readonly mode: EditMode;
  select(ids: string[]): void;
  selectPart(clipId: string, part: string): void;
  edit(result: OpResult, summary: string): void;
  preview(doc: MotionDoc | null): void;
};

let canvas = $state.raw<CanvasSide | null>(null);
let video = $state.raw<VideoSide | null>(null);
let hovered = $state.raw<LayerHover>(null);
let glyphs = $state.raw<ReadonlyMap<string, string | undefined>>(new Map());

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
  get hovered() {
    return hovered;
  },
  get glyphs() {
    return glyphs;
  },
  setGlyphs(next: ReadonlyMap<string, string | undefined>) {
    if (next.size !== glyphs.size || [...next].some(([id, glyph]) => glyphs.get(id) !== glyph)) {
      glyphs = next;
    }
  },
  hover(target: LayerHover) {
    if (target?.nodeId !== hovered?.nodeId || target?.id !== hovered?.id) {
      hovered = target;
    }
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
