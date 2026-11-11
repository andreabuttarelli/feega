export const TILE_PX = 256;
export const TILE_GUTTER_PX = 2;
export const TILE_SIDE_PX = TILE_PX + 2 * TILE_GUTTER_PX;

const STEPS_PER_DOUBLING = 4;
const STEP_SLACK = 1e-9;
const OPAQUE = 255;
const COARSE_LEVELS: readonly { steps: number; reach: number }[] = [
  { steps: -4, reach: 2.5 },
  { steps: -12, reach: 9 },
  { steps: -16, reach: 17 }
];

export enum Basis {
  Target = 'target',
  Shown = 'shown'
}

export type TileKey = { step: number; tx: number; ty: number };
export type WorldBox = { x: number; y: number; w: number; h: number };
export type TileLayer = { id: string; content: string | null; box: WorldBox };
export type TileLook = { canvasId: string; paper: string; line: string; resolution: number };
export type DiskEntry = { key: string; bytes: number; used: number };

export const stepOf = (zoom: number): number => Math.ceil(Math.log2(zoom) * STEPS_PER_DOUBLING - STEP_SLACK) + 0;

const stepZoom = (step: number) => 2 ** (step / STEPS_PER_DOUBLING);

export function tileWorld({ step, tx, ty }: TileKey): WorldBox {
  const side = TILE_PX / stepZoom(step);
  return { x: tx * side, y: ty * side, w: side, h: side };
}

const overlaps = (a: WorldBox, b: WorldBox) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function keysOver(world: WorldBox, step: number): TileKey[] {
  const side = TILE_PX / stepZoom(step);
  const [x0, y0, x1, y1] = [Math.floor(world.x / side) + 0, Math.floor(world.y / side) + 0, Math.ceil((world.x + world.w) / side), Math.ceil((world.y + world.h) / side)];
  const keys: TileKey[] = [];
  for (let ty = y0; ty < y1; ty++) {
    for (let tx = x0; tx < x1; tx++) {
      keys.push({ step, tx, ty });
    }
  }
  return keys;
}

const grown = (b: WorldBox, reach: number): WorldBox => ({ x: b.x - (b.w * (reach - 1)) / 2, y: b.y - (b.h * (reach - 1)) / 2, w: b.w * reach, h: b.h * reach });

type Camera = { x: number; y: number; zoom: number };
type Screen = { width: number; height: number };

const seenWorld = (camera: Camera, screen: Screen): WorldBox => ({ x: -camera.x / camera.zoom, y: -camera.y / camera.zoom, w: screen.width / camera.zoom, h: screen.height / camera.zoom });

export const viewTiles = (camera: Camera, screen: Screen): TileKey[] => keysOver(seenWorld(camera, screen), stepOf(camera.zoom));

export function tilesToRestore(camera: Camera, screen: Screen): TileKey[] {
  const seen = seenWorld(camera, screen);
  const step = stepOf(camera.zoom);
  return [...viewTiles(camera, screen), ...COARSE_LEVELS.flatMap((level) => keysOver(grown(seen, level.reach), step + level.steps))];
}

function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}

export function tileIdentity(key: TileKey, layers: readonly TileLayer[]): string | null {
  const world = tileWorld(key);
  const gutter = TILE_GUTTER_PX / stepZoom(key.step);
  const reach = { x: world.x - gutter, y: world.y - gutter, w: world.w + 2 * gutter, h: world.h + 2 * gutter };
  const touching = layers.filter((l) => overlaps(l.box, reach));
  if (!touching.length || touching.some((l) => l.content === null)) {
    return null;
  }
  return hash(touching.map((l) => `${l.content}@${l.box.x},${l.box.y},${l.box.w},${l.box.h}`).join('|'));
}

export const cacheKey = (look: TileLook, { step, tx, ty }: TileKey, identity: string): string => `${look.canvasId}/${hash(`${look.paper}${look.line}${look.resolution}`)}_${step}_${tx}_${ty}_${identity}`;

export const canvasOf = (key: string): string => key.slice(0, key.indexOf('/'));

export function evictions(entries: readonly DiskEntry[], cap: number): string[] {
  let total = entries.reduce((sum, e) => sum + e.bytes, 0);
  const gone: string[] = [];
  for (const entry of [...entries].sort((a, b) => a.used - b.used)) {
    if (total <= cap) {
      break;
    }
    total -= entry.bytes;
    gone.push(entry.key);
  }
  return gone;
}

export function unpremultiply(pixels: Uint8Array): Uint8Array {
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a === OPAQUE || a === 0) {
      continue;
    }
    pixels[i] = Math.min(OPAQUE, Math.round((pixels[i] * OPAQUE) / a));
    pixels[i + 1] = Math.min(OPAQUE, Math.round((pixels[i + 1] * OPAQUE) / a));
    pixels[i + 2] = Math.min(OPAQUE, Math.round((pixels[i + 2] * OPAQUE) / a));
  }
  return pixels;
}

export function premultiply(pixels: Uint8Array): Uint8Array {
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a === OPAQUE) {
      continue;
    }
    pixels[i] = Math.round((pixels[i] * a) / OPAQUE);
    pixels[i + 1] = Math.round((pixels[i + 1] * a) / OPAQUE);
    pixels[i + 2] = Math.round((pixels[i + 2] * a) / OPAQUE);
  }
  return pixels;
}
