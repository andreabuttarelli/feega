import { liveFrameOf, liveUrl } from '$lib/canvas/live-frame';

type NodeData = { id: string; data: Record<string, unknown> };

export type PosterDeps = {
  origin: string;
  readNode: (id: string) => Promise<NodeData | null>;
  capture: (url: string, width: number) => Promise<Uint8Array>;
  saveImage: (bytes: Uint8Array) => Promise<string>;
  writeData: (id: string, data: Record<string, unknown>) => Promise<void>;
};

export async function captureLivePoster(nodeId: string, deps: PosterDeps): Promise<string> {
  const node = await deps.readNode(nodeId);
  const live = liveFrameOf(node?.data);
  if (!node || !live) {
    throw new Error(`${nodeId} is not a live frame`);
  }

  const bytes = await deps.capture(liveUrl(deps.origin, live.route), live.width);
  const poster = await deps.saveImage(bytes);
  await deps.writeData(nodeId, { ...node.data, live: { ...live, poster } });
  return poster;
}
