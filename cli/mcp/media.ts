import type { Media, MediaItem } from '../lib/api.ts';

export type LoadMedia = (assetIds: string[]) => Promise<Media>;

function describeItem(item: MediaItem) {
  return {
    asset_id: item.assetId,
    node_id: item.nodeId,
    run_id: item.runId,
    type: item.type,
    mime_type: item.mimeType,
    width: item.width,
    height: item.height,
    duration_s: item.durationS,
    bytes: item.bytes,
    preview_url: item.previewUrl,
    full_url: item.fullUrl,
    text: item.text
  };
}

export function mediaView(media: Media) {
  return { items: media.items.map(describeItem), missing: media.missing };
}

type Outcome = { asset?: { id?: string } } & Record<string, unknown>;

export async function generationView(outcome: Outcome, loadMedia: LoadMedia) {
  const assetIds = outcome.asset?.id ? [outcome.asset.id] : [];
  const media = assetIds.length ? (await loadMedia(assetIds)).items.map(describeItem) : [];

  return { ...outcome, asset_ids: assetIds, media };
}
