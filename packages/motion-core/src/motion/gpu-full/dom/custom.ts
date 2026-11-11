import type { Prepared, DomReads, ImageItem, LayerItem } from '../display-list';
import type { Picture } from '../raster';
import { readTree } from './read';
import { mountDomReader, type Compose } from './reader';
import { NO_INDEX } from './tree';
import { screenFrames } from '../../device-screen';
import type { MotionDoc } from '../../doc';
import { flattenComps } from '../../precomp';

export type CustomFrame = { reads: DomReads; picture: (item: ImageItem | LayerItem) => Picture | null };

export type CustomReads = { readAt: (frame: number) => Promise<CustomFrame>; dispose: () => void };

const READ: ReadonlySet<string> = new Set(['Custom', 'Device3D', 'Composition']);

type Props = Record<string, unknown>;

const PICTURED: Record<string, (props: Props, logo: string | null) => boolean> = {
  Image: (props) => Boolean(props.assetId),
  Video: (props) => Boolean(props.assetId),
  Logo: (props, logo) => Boolean(props.assetId || logo)
};

const readsDom = (clip: { component: string; props: Props }, logo: string | null) => READ.has(clip.component) || PICTURED[clip.component]?.(clip.props, logo) === false;

export function readClips(doc: MotionDoc, logo: string | null = null): { read: string[]; moving: string[]; composed: ReadonlySet<string> } {
  const clips = flattenComps(doc).tracks.flatMap((t) => t.clips);
  const screens = screenFrames(doc).map((s) => s.prefix);
  const read = clips.filter((c) => readsDom(c, logo)).map((c) => c.id);
  const moving = clips.filter((c) => READ.has(c.component)).map((c) => c.id);
  const onScreen = clips.filter((c) => screens.some((prefix) => c.id.startsWith(prefix))).map((c) => c.id);
  return { read, moving, composed: new Set([...read, ...onScreen]) };
}
const NO_FRAME: CustomFrame = { reads: new Map(), picture: () => null };

export async function mountCustomReads(host: HTMLElement, compose: Compose, prepared: Prepared): Promise<CustomReads> {
  const { doc } = prepared;
  const { read: clips, moving, composed } = readClips(doc, prepared.tokens.logoUrl);
  if (!clips.length) {
    return { readAt: async () => NO_FRAME, dispose: () => {} };
  }
  const reader = await mountDomReader(host, compose, clips, composed, { width: doc.width, height: doc.height });
  const surfaces = new Map<string, HTMLCanvasElement>();

  const surface = (key: string, bitmap: ImageBitmap) => {
    const canvas = surfaces.get(key) ?? surfaces.set(key, document.createElement('canvas')).get(key)!;
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    (canvas.getContext('bitmaprenderer') as ImageBitmapRenderingContext).transferFromImageBitmap(bitmap);
    return canvas;
  };

  type Read = { reads: DomReads; pictures: Map<string, Picture> };
  let still: Read | null = null;

  const readOnce = async (frame: number, only: string[]): Promise<Read> => {
    if (!only.length) {
      return { reads: new Map(), pictures: new Map() };
    }
    const reply = await reader.readAt(frame / doc.fps, only);
    const reads = new Map(Object.entries(reply.trees).map(([clip, tree]) => [clip, readTree(tree, prepared.typeset)]));
    const owners = Object.entries(reply.trees).flatMap(([clip, tree]) => tree.nodes.flatMap((n) => [n.layer, n.raster?.layer ?? NO_INDEX]).filter((layer) => layer !== NO_INDEX).map((layer) => [`${clip}:${layer}` as string, reply.layers[layer]] as const));
    const pictureOf = (key: string, bitmap: ImageBitmap) => {
      const canvas = surface(key, bitmap);
      return { source: canvas, size: { width: canvas.width, height: canvas.height } };
    };
    return { reads, pictures: new Map(owners.map(([key, bitmap]) => [key, pictureOf(key, bitmap)])) };
  };

  const isStill = (clip: string) => !moving.includes(clip);
  const stillPart = ({ reads, pictures }: Read): Read => ({ reads: new Map([...reads].filter(([clip]) => isStill(clip))), pictures: new Map([...pictures].filter(([key]) => isStill(key.slice(0, key.lastIndexOf(':'))))) });

  const readAt = async (frame: number): Promise<CustomFrame> => {
    const fresh = await readOnce(frame, still ? moving : clips);
    still ??= stillPart(fresh);
    const reads = new Map([...still.reads, ...fresh.reads]);
    const pictures = new Map([...still.pictures, ...fresh.pictures]);
    return { reads, picture: (item) => ('source' in item ? (pictures.get(item.source) ?? null) : null) };
  };

  return { readAt, dispose: () => reader.dispose() };
}
