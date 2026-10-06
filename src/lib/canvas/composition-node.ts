import type { LayoutId } from './composition/types';
import type { CameraPresetId } from './composition/camera';
import type { CellSpec } from '$lib/motion/components';

export type CompositionAspect = '9:16' | '1:1' | '16:9';

export type CompositionNode = {
  id: string;
  layout: LayoutId;
  layoutParams: Record<string, number | string>;
  camera: { preset: CameraPresetId; params: Record<string, number | string> };
  background: { color: string };
  duration: number;
  aspect: CompositionAspect;
  refId: string | null;
  cells: Record<string, CellSpec>;
};

const COMPOSITION_NODE_SIZE = { w: 320, h: 240 };

export function compositionNodeSize(): { w: number; h: number } {
  return { ...COMPOSITION_NODE_SIZE };
}

export type NewCompositionTile = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  layout: LayoutId;
  layoutParams: Record<string, number | string>;
  camera: { preset: CameraPresetId; params: Record<string, number | string> };
  background: { color: string };
  duration: number;
  aspect: CompositionAspect;
  connectable: true;
};

const DEFAULT_LAYOUT: LayoutId = 'tilted-grid';
const DEFAULT_CAMERA: CameraPresetId = 'slow-orbit';
const DEFAULT_BACKGROUND = '#000000';
const DEFAULT_DURATION_SECONDS = 6;
const DEFAULT_ASPECT: CompositionAspect = '9:16';

export function newCompositionNodeAt(at: { x: number; y: number }): NewCompositionTile {
  const { w, h } = compositionNodeSize();

  return {
    id: crypto.randomUUID(),
    x: at.x - w / 2,
    y: at.y - h / 2,
    w,
    h,
    layout: DEFAULT_LAYOUT,
    layoutParams: {},
    camera: { preset: DEFAULT_CAMERA, params: {} },
    background: { color: DEFAULT_BACKGROUND },
    duration: DEFAULT_DURATION_SECONDS,
    aspect: DEFAULT_ASPECT,
    connectable: true
  };
}

const IMAGE_REF_FIELDS = ['refId', 'assetId'] as const;

export type UpstreamMedia = { assetId: string; kind: 'image' | 'video' };
export type UpstreamMotion = { kind: 'motion'; revision: number; posterAssetId: string | null };
export type UpstreamCard = { sourceId: string } & (UpstreamMedia | UpstreamMotion);
type Source = { id: string; type?: string; data: Record<string, unknown> };
type Edge = { source: string; target: string };

const VIDEO_TYPE = 'video';
const MOTION_TYPE = 'motion';

function feeds(edges: Edge[], from: string, to: string): boolean {
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length) {
    const at = queue.shift()!;
    if (at === to) {
      return true;
    }
    if (seen.has(at)) {
      continue;
    }
    seen.add(at);
    queue.push(...edges.filter((e) => e.source === at).map((e) => e.target));
  }
  return false;
}

function listCards(source: Source, items: unknown[]): UpstreamCard[] {
  return items.flatMap((item) => {
    const assetId = (item as Record<string, unknown>)?.asset_id;
    return typeof assetId === 'string' && assetId ? [{ sourceId: source.id, assetId, kind: 'image' as const }] : [];
  });
}

function motionCard(targetId: string, edges: Edge[], source: Source): UpstreamCard[] {
  if (feeds(edges, targetId, source.id)) {
    return [];
  }
  const revision = Number(source.data.docHeadRevision ?? 0);
  const poster = source.data.posterAssetId;
  return [{ sourceId: source.id, kind: 'motion', revision, posterAssetId: typeof poster === 'string' && poster ? poster : null }];
}

function cardsOf(targetId: string, edges: Edge[], source: Source): UpstreamCard[] {
  if (source.type === MOTION_TYPE) {
    return motionCard(targetId, edges, source);
  }
  if (Array.isArray(source.data.items)) {
    return listCards(source, source.data.items);
  }
  const ref = IMAGE_REF_FIELDS.map((field) => source.data[field]).find((v) => typeof v === 'string' && v);
  return typeof ref === 'string' ? [{ sourceId: source.id, assetId: ref, kind: source.type === VIDEO_TYPE ? 'video' : 'image' }] : [];
}

export function upstreamCards(targetId: string, edges: Edge[], nodes: Source[]): UpstreamCard[] {
  return edges.flatMap((edge) => {
    const source = edge.target === targetId ? nodes.find((node) => node.id === edge.source) : undefined;
    return source ? cardsOf(targetId, edges, source) : [];
  });
}

export function upstreamMedia(targetId: string, edges: Edge[], nodes: Source[]): UpstreamMedia[] {
  return upstreamCards(targetId, edges, nodes).flatMap((card) => (card.kind === MOTION_TYPE ? [] : [{ assetId: card.assetId, kind: card.kind }]));
}

export function upstreamImageRefs(targetId: string, edges: Edge[], nodes: Source[]): string[] {
  return upstreamMedia(targetId, edges, nodes).map((m) => m.assetId);
}

export type MotionCard = UpstreamCard & UpstreamMotion;

export function staleMotions(cards: UpstreamCard[], loaded: Record<string, number>): MotionCard[] {
  return cards.filter((c): c is MotionCard => c.kind === MOTION_TYPE && loaded[c.sourceId] !== c.revision);
}

export function cardAssetIds(cards: UpstreamCard[]): string[] {
  return cards.flatMap((c) => (c.kind === MOTION_TYPE ? (c.posterAssetId ? [c.posterAssetId] : []) : [c.assetId]));
}

export type BentoGridKey = 'columns' | 'rows' | 'gap' | 'cornerRadius';
export type SpanKey = 'columns' | 'rows';

export function bentoGridPatch(node: Pick<CompositionNode, 'layoutParams'>, key: BentoGridKey, value: number): Pick<CompositionNode, 'layoutParams'> {
  return { layoutParams: { ...node.layoutParams, [key]: value } };
}

export function cellSpanPatch(node: Pick<CompositionNode, 'cells'>, sourceId: string, key: SpanKey, value: number): Pick<CompositionNode, 'cells'> {
  return { cells: { ...node.cells, [sourceId]: { ...node.cells[sourceId], [key]: value } } };
}

export const ASSET_IDS_PARAM = 'ids';

export function assetUrlsPath(input: { projectId: string; canvasId: string; ids: string[] }): string {
  return `/p/${input.projectId}/c/${input.canvasId}/asset-urls?${ASSET_IDS_PARAM}=${input.ids.join(',')}`;
}
