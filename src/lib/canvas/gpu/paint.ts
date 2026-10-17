import type { Viewport } from '../dot-grid';
import type { NodeType } from '../node-data';
import { isUploadedNodeRow } from '../uploaded-node';
import { visibleIds, type Screen } from './camera';

export enum Paint {
  Gpu = 'gpu',
  Dom = 'dom'
}

type Data = Record<string, unknown>;

const gpu = () => Paint.Gpu;
const dom = () => Paint.Dom;

export const PAINT: Record<NodeType, (data: Data) => Paint> = {
  motion: gpu,
  image: (data) => (isUploadedNodeRow({ type: 'image', data }) ? Paint.Gpu : Paint.Dom),
  text: dom,
  video: dom,
  doc: dom,
  audio: dom,
  model3d: dom,
  iframe: dom,
  social_account_feed: dom,
  social_post_mockup: dom,
  products: dom,
  ads: dom,
  influencer: dom,
  list: dom,
  select: dom,
  effects: dom,
  composition: dom,
  calendar: dom,
  studio_batch: dom
};

type Placed = { id: string; kind?: string; x: number; y: number; w: number; h: number };

const paintOf = (kind: string | undefined, data: Data) => (kind && kind in PAINT ? PAINT[kind as NodeType](data) : Paint.Gpu);

export function domPainted(tiles: Placed[], dataOf: (id: string) => Data, view: Viewport, screen: Screen, far: boolean): string[] {
  if (far) {
    return [];
  }
  const dom = tiles.filter((t) => paintOf(t.kind, dataOf(t.id)) === Paint.Dom);
  const seen = visibleIds(dom, view, screen);
  return dom.filter((t) => seen.has(t.id)).map((t) => t.id);
}
