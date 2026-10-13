import type { MotionDoc } from './doc';
import { Viewport } from './editor-layout';
import { Dock } from '$lib/canvas/free-area';

export enum Mount {
  Page = 'page',
  Canvas = 'canvas'
}

export enum Stage {
  Own = 'own',
  Node = 'node'
}

export enum Zoom {
  Stage = 'stage',
  Canvas = 'canvas'
}

export enum Measure {
  Window = 'window',
  Host = 'host'
}

type MountRules = { ownsTitle: boolean; closes: boolean; stage: Stage; zoom: Zoom; measure: Measure };

export const MOUNT: Record<Mount, MountRules> = {
  [Mount.Page]: { ownsTitle: true, closes: false, stage: Stage.Own, zoom: Zoom.Stage, measure: Measure.Window },
  [Mount.Canvas]: { ownsTitle: false, closes: true, stage: Stage.Node, zoom: Zoom.Canvas, measure: Measure.Host }
};

const STILL_FRAMES = 1;

export const timelineFits = (doc: Pick<MotionDoc, 'durationInFrames'>) => doc.durationInFrames > STILL_FRAMES;

export enum Part {
  Bar = 'bar',
  Transport = 'transport',
  Side = 'side',
  Panel = 'panel',
  Timeline = 'timeline',
  Tabs = 'tabs'
}

const WIDE: Record<Part, Dock> = {
  [Part.Bar]: Dock.TopBar,
  [Part.Transport]: Dock.TopBar,
  [Part.Side]: Dock.RightPanel,
  [Part.Panel]: Dock.RightPanel,
  [Part.Timeline]: Dock.Timeline,
  [Part.Tabs]: Dock.Timeline
};

export const PART_DOCK: Record<Viewport, Record<Part, Dock>> = {
  [Viewport.Desktop]: WIDE,
  [Viewport.Tablet]: WIDE,
  [Viewport.Phone]: { ...WIDE, [Part.Transport]: Dock.Timeline, [Part.Panel]: Dock.Timeline }
};

export enum BarPlace {
  CanvasBar = 'canvas-bar',
  OwnRow = 'own-row'
}

export const BAR_PLACE: Record<Viewport, BarPlace> = {
  [Viewport.Desktop]: BarPlace.CanvasBar,
  [Viewport.Tablet]: BarPlace.CanvasBar,
  [Viewport.Phone]: BarPlace.OwnRow
};
