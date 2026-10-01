type MediaNode = { type: string; data: Record<string, unknown> };

export type AudioOutputIds = { videoId: string | null; audioId: string | null };

const idOf = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

export function audioOutputIds(data: Record<string, unknown>): AudioOutputIds {
  const refs = data.outputRefs && typeof data.outputRefs === 'object' ? (data.outputRefs as Record<string, unknown>) : {};
  const videoId = idOf(refs.videos);
  return { videoId, audioId: idOf(refs.audios) ?? (videoId ? null : idOf(data.refId)) };
}

const audioMedia = (data: Record<string, unknown>): string | null => {
  const { videoId, audioId } = audioOutputIds(data);
  return videoId ?? audioId;
};

const MEDIA_ASSET_OF: Partial<Record<string, (data: Record<string, unknown>) => string | null>> = {
  image: (data) => idOf(data.assetId) ?? idOf(data.refId),
  video: (data) => idOf(data.assetId) ?? idOf(data.refId),
  audio: audioMedia
};

export function nodeMediaAsset(node: MediaNode): string | null {
  if (node.data.running === true) {
    return null;
  }
  return MEDIA_ASSET_OF[node.type]?.(node.data) ?? null;
}
