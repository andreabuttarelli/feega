import { CanvasState } from './inline-motion';
import { Region } from './key-region.svelte';

export enum BarContext {
  Canvas = 'canvas',
  Frame = 'frame'
}

export enum BarSlot {
  Upload = 'upload',
  Nodes = 'nodes',
  More = 'more',
  Templates = 'templates',
  FrameTemplates = 'frame-templates',
  Draw = 'draw',
  Image = 'image',
  FrameLibrary = 'frame-library'
}

type ContextRules = { slots: readonly BarSlot[]; followsTimeline: boolean; keys: Region };

const CONTEXT: Record<BarContext, ContextRules> = {
  [BarContext.Canvas]: { slots: [BarSlot.Upload, BarSlot.Nodes, BarSlot.More, BarSlot.Templates, BarSlot.FrameTemplates], followsTimeline: false, keys: Region.Canvas },
  [BarContext.Frame]: { slots: [BarSlot.Draw, BarSlot.Image, BarSlot.FrameLibrary], followsTimeline: true, keys: Region.Editor }
};

export const BAR_SLOTS = Object.fromEntries(Object.entries(CONTEXT).map(([context, rules]) => [context, rules.slots])) as Record<BarContext, readonly BarSlot[]>;

const STATE_CONTEXT: Record<CanvasState, BarContext> = {
  [CanvasState.Browsing]: BarContext.Canvas,
  [CanvasState.Editing]: BarContext.Frame
};

export const barContextOf = (state: CanvasState): BarContext => STATE_CONTEXT[state];

export const barLift = (context: BarContext, timelinePx: number): number => (CONTEXT[context].followsTimeline ? timelinePx : 0);

const HALF = 2;

export const barShift = (context: BarContext, sidePx: number): number => (CONTEXT[context].followsTimeline ? sidePx / HALF : 0);

export const barKeys = (context: BarContext): Region => CONTEXT[context].keys;
