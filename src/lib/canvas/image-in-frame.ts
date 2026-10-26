import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { OutputKind, mediaElement, placeElement, type Placed } from '$lib/motion/move-element';

const FRAME_CENTRE = { x: 0.5, y: 0.5 };
const NEW_ID_LENGTH = 8;
export const PENDING_ASSET = 'pending-';

export type Picture = { assetId: string; name: string; width: number | null; height: number | null };

export function imageInFrame(doc: MotionDoc, picture: Picture): Placed {
  const element = mediaElement({ kind: OutputKind.Image, ...picture }, doc.fps);
  return placeElement(doc, element, { at: FRAME_CENTRE }, () => crypto.randomUUID().slice(0, NEW_ID_LENGTH));
}

export function withAssetSwapped(doc: MotionDoc, from: string, to: string): MotionDoc {
  const clips = (list: MotionDoc['tracks'][number]['clips']) => list.map((c) => (c.props.assetId === from ? { ...c, props: { ...c.props, assetId: to } } : c));
  return {
    ...doc,
    assets: doc.assets.map((a) => (a.id === from ? { ...a, id: to } : a)),
    tracks: doc.tracks.map((t) => ({ ...t, clips: clips(t.clips) }))
  };
}

export async function sizeOfImage(file: Blob): Promise<{ width: number | null; height: number | null }> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  const size = { width: bitmap?.width ?? null, height: bitmap?.height ?? null };
  bitmap?.close();
  return size;
}
