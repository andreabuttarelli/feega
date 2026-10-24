import type { Db } from '$lib/server/db/client';
import { findNode } from '$lib/server/repos/canvas';
import { findAssets } from '$lib/server/repos/assets';
import type { Actor } from '$lib/server/repos/actor';
import { frameStore } from '$lib/server/motion/move-element';
import { layersFrame, type PlacedLayer } from '$lib/motion/layers-frame';
import { OutputKind, type Output } from '$lib/motion/move-element';
import type { MotionDoc } from '$lib/motion/doc';
import type { LayerBox } from '$lib/layer-boxes';

const FRAME_GAP = 80;
const DEFAULT_NODE_WIDTH = 320;

type Place = { projectId: string; canvasId: string; x: number; y: number };

export type LayersToFrameDeps = {
  findNode: typeof findNode;
  findAssets: typeof findAssets;
  createFrame: (place: Place, doc: MotionDoc) => Promise<string>;
};

export function layersToFrameDeps(db: Db, scope: { orgId: string; projectId: string; actor: Actor }): LayersToFrameDeps {
  const store = frameStore(db, scope);
  return { findNode, findAssets, createFrame: (place, doc) => store.create(place, doc) };
}

export type LayersToFrame = { ok: true; frameId: string } | { ok: false; error: string };

type AssetFacts = { id: string; width: number | null; height: number | null };

const pictureOf = (asset: AssetFacts, name: string): Output => ({ kind: OutputKind.Image, assetId: asset.id, name, width: asset.width, height: asset.height });

const stringsOf = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

const boxesOf = (value: unknown): LayerBox[] => (Array.isArray(value) ? (value as LayerBox[]) : []);

export async function layersToFrame(db: Db, deps: LayersToFrameDeps, input: { orgId: string; nodeId: string }): Promise<LayersToFrame> {
  const node = await deps.findNode(db, input);
  if (!node) {
    return { ok: false, error: 'node_not_found' };
  }
  if (node.type !== 'image') {
    return { ok: false, error: 'source_not_image' };
  }

  const baseId = String(node.data.refId ?? '');
  const layerIds = stringsOf(node.data.layerRefIds);
  if (!baseId || !layerIds.length) {
    return { ok: false, error: 'no_layers' };
  }

  const assets = await deps.findAssets(db, { orgId: input.orgId, assetIds: [baseId, ...layerIds] });
  const base = assets.get(baseId);
  const boxes = boxesOf(node.data.layerBoxes);
  const layers = layerIds.flatMap((id, index): PlacedLayer[] => {
    const asset = assets.get(id);
    const known = boxes[index];
    return asset && known ? [{ output: pictureOf(asset, known.label), box: known.box }] : [];
  });
  if (!base || !layers.length) {
    return { ok: false, error: 'no_layers' };
  }

  const doc = layersFrame(pictureOf(base, node.displayName ?? 'Layers'), layers, () => crypto.randomUUID().slice(0, 8));
  const frameId = await deps.createFrame(
    { projectId: node.projectId, canvasId: node.canvasId, x: node.position.x + (node.size.width ?? DEFAULT_NODE_WIDTH) + FRAME_GAP, y: node.position.y },
    doc
  );
  return { ok: true, frameId };
}
