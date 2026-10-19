import type { Prepared, DomReads, ImageItem, LayerItem } from '../display-list';
import type { Picture } from '../raster';
import { readTree } from './read';
import { mountDomReader, type Compose } from './reader';

export type CustomFrame = { reads: DomReads; picture: (item: ImageItem | LayerItem) => Picture | null };

export type CustomReads = { readAt: (frame: number) => Promise<CustomFrame>; dispose: () => void };

const CUSTOM = 'Custom';
const NO_FRAME: CustomFrame = { reads: new Map(), picture: () => null };

export async function mountCustomReads(host: HTMLElement, compose: Compose, { doc }: Prepared): Promise<CustomReads> {
  const clips = doc.tracks.flatMap((t) => t.clips).filter((c) => c.component === CUSTOM).map((c) => c.id);
  if (!clips.length) {
    return { readAt: async () => NO_FRAME, dispose: () => {} };
  }
  const reader = await mountDomReader(host, compose, clips, { width: doc.width, height: doc.height });
  const surfaces = new Map<string, HTMLCanvasElement>();

  const surface = (key: string, bitmap: ImageBitmap) => {
    const canvas = surfaces.get(key) ?? surfaces.set(key, document.createElement('canvas')).get(key)!;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    (canvas.getContext('bitmaprenderer') as ImageBitmapRenderingContext).transferFromImageBitmap(bitmap);
    return canvas;
  };

  const readAt = async (frame: number): Promise<CustomFrame> => {
    const reply = await reader.readAt(frame / doc.fps);
    const reads = new Map(Object.entries(reply.trees).map(([clip, tree]) => [clip, readTree(tree)]));
    const owners = Object.entries(reply.trees).flatMap(([clip, tree]) => tree.nodes.filter((n) => n.layer >= 0).map((n) => [`${clip}:${n.layer}` as string, reply.layers[n.layer]] as const));
    const pictures = new Map(owners.map(([key, bitmap]) => [key, { source: surface(key, bitmap), size: { width: bitmap.width, height: bitmap.height } }]));
    return { reads, picture: (item) => ('source' in item ? (pictures.get(item.source) ?? null) : null) };
  };

  return { readAt, dispose: () => reader.dispose() };
}
