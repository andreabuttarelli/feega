import type { SvgNode } from '../../effects/registry';

export const DOM_READ_REQUEST = 'feega:dom-read';
export const DOM_READ_REPLY = 'feega:dom-read-reply';
export const CUSTOM_ROOT_PREFIX = 'cc-';
export const NO_INDEX = -1;
export const TEXT_PAD = 16;

export const READ_STYLES = [
  'display',
  'position',
  'visibility',
  'opacity',
  'transform',
  'transform-origin',
  'z-index',
  'overflow',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'box-shadow',
  'filter',
  'backdrop-filter',
  'mix-blend-mode',
  'clip-path',
  'mask-image',
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'white-space',
  'text-transform',
  '-webkit-font-smoothing',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray'
] as const;

export const READ_ATTRS = ['points', 'd', 'x', 'y', 'width', 'height', 'rx', 'ry', 'r', 'cx', 'cy', 'viewBox', 'href', 'class'] as const;

export type ReadStyle = (typeof READ_STYLES)[number];
export type ReadAttr = (typeof READ_ATTRS)[number];

export type TextLine = { chars: string[]; xs: number[]; top: number; height: number };

export type TextRaster = { layer: number; width: number; height: number; at: [number, number] };

export type RawNode = {
  tag: string;
  svg: boolean;
  parent: number;
  at: [number, number] | null;
  size: [number, number];
  style: Partial<Record<ReadStyle, string>>;
  attrs: Partial<Record<ReadAttr, string>>;
  text: string;
  lines: TextLine[];
  raster: TextRaster | null;
  layer: number;
};

export type RawTree = { width: number; height: number; nodes: RawNode[]; defs: Record<string, SvgNode> };

export type DomReadRequest = { type: typeof DOM_READ_REQUEST; id: string; time: number; clips: string[] };

export type DomReadReply = { type: typeof DOM_READ_REPLY; id: string; time: number; trees: Record<string, RawTree>; layers: ImageBitmap[]; error?: string };
