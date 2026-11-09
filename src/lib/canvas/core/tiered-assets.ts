import { AssetKind } from '@feega/motion-core/motion/components';
import { canvasAssetUrl, type AssetSize } from '$lib/canvas/asset-url';
import type { FrameDoc } from './frame-build';

type Hinted = FrameDoc & { media?: Record<string, { kind: AssetKind }> };
type Place = { projectId: string; canvasId: string };

export function tieredAssets(source: Hinted, place: Place, tier: AssetSize): FrameDoc {
  const images = Object.entries(source.media ?? {}).filter(([id, hint]) => hint.kind === AssetKind.Image && source.assets[id]);
  if (!images.length) {
    return source;
  }

  const sized = Object.fromEntries(images.map(([id]) => [id, canvasAssetUrl(place.projectId, place.canvasId, id, tier)]));
  return { ...source, assets: { ...source.assets, ...sized } };
}
