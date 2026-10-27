import { AssetSize, canvasAssetUrl } from './asset-url';
import type { GenMedium } from './gen-node';

const OPENABLE: ReadonlySet<GenMedium> = new Set(['image', 'video']);

export function outputTabUrl(place: { projectId: string; canvasId: string }, output: { medium: GenMedium; refId: string | null }): string | null {
  if (!output.refId || !OPENABLE.has(output.medium)) {
    return null;
  }
  return canvasAssetUrl(place.projectId, place.canvasId, output.refId, AssetSize.Full);
}
