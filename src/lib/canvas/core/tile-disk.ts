import { Basis, cacheKey, tileIdentity, tilesToRestore, viewTiles, type TileKey, type TileLayer, type TileLook } from './tile-cache';
import type { TileCodec } from './tile-codec';
import type { TileStore } from './tile-store';

const SAVES_PER_PASS = 8;
const RESTORE_LANES = 4;

export type DiskRaster = {
  freshTiles: () => number[];
  readTile: (step: number, tx: number, ty: number) => Promise<Uint8Array> | null;
  putTile: (step: number, tx: number, ty: number, pixels: Uint8Array) => boolean;
  settleTile: (step: number, tx: number, ty: number) => void;
  forgetTile: (step: number, tx: number, ty: number) => void;
  releaseTiles: () => void;
};

type Deps = { store: TileStore; codec: TileCodec; raster: DiskRaster; look: () => TileLook; layers: (basis: Basis) => TileLayer[]; busy: () => boolean; viewStep: () => number; encoded?: (ms: number, bytes: number, key: TileKey) => void };

export type Restored = { count: number; covered: boolean; view: TileKey[] };

export type TileDisk = { restore: (camera: { x: number; y: number; zoom: number }, screen: { width: number; height: number }) => Promise<Restored>; check: () => void; settle: () => void; release: () => void; importing: () => boolean; save: () => Promise<boolean> };

const keysOf = (flat: number[]): TileKey[] => Array.from({ length: flat.length / 3 }, (_, i) => ({ step: flat[3 * i], tx: flat[3 * i + 1], ty: flat[3 * i + 2] }));

export function tileDisk({ store, codec, raster, look, layers, busy, viewStep, encoded = () => {} }: Deps): TileDisk {
  const imported = new Map<string, { key: TileKey; identity: string }>();
  const saved = new Set<string>();
  const tried = new Set<string>();
  let released = false;
  const keyOf = (key: TileKey, basis: Basis) => {
    const identity = tileIdentity(key, layers(basis));
    return identity ? { identity, stored: cacheKey(look(), key, identity) } : null;
  };

  async function restoreOne(key: TileKey): Promise<boolean> {
    const at = keyOf(key, Basis.Target);
    if (released || !at || tried.has(at.stored)) {
      return false;
    }
    tried.add(at.stored);
    const blob = at && (await store.get(at.stored));
    if (!at || !blob) {
      return false;
    }
    const pixels = await codec.decode(blob);
    if (keyOf(key, Basis.Target)?.stored !== at.stored || !raster.putTile(key.step, key.tx, key.ty, pixels)) {
      return false;
    }
    imported.set(at.stored, { key, identity: at.identity });
    saved.add(at.stored);
    return true;
  }

  return {
    restore: async (camera, screen) => {
      const queue = tilesToRestore(camera, screen);
      const shown = new Set<string>();
      let restored = 0;
      const lane = async () => {
        for (let key = queue.shift(); key; key = queue.shift()) {
          const put = await restoreOne(key).catch(() => false);
          restored += put ? 1 : 0;
          if (put) {
            shown.add(`${key.step}_${key.tx}_${key.ty}`);
          }
        }
      };
      await Promise.all(Array.from({ length: RESTORE_LANES }, lane));
      const wanted = viewTiles(camera, screen).filter((k) => tileIdentity(k, layers(Basis.Target)) !== null);
      const covered = restored > 0 && wanted.every((k) => shown.has(`${k.step}_${k.tx}_${k.ty}`) || [...imported.values()].some((i) => i.key.step === k.step && i.key.tx === k.tx && i.key.ty === k.ty));
      const view = wanted.filter((k) => shown.has(`${k.step}_${k.tx}_${k.ty}`));
      return { count: restored, covered, view };
    },
    check: () => {
      const target = imported.size ? layers(Basis.Target) : [];
      for (const [stored, { key, identity }] of imported) {
        if (tileIdentity(key, target) !== identity) {
          raster.forgetTile(key.step, key.tx, key.ty);
          imported.delete(stored);
        }
      }
    },
    settle: () => {
      const shown = imported.size ? layers(Basis.Shown) : [];
      for (const [stored, { key, identity }] of imported) {
        if (tileIdentity(key, shown) === identity) {
          raster.settleTile(key.step, key.tx, key.ty);
          imported.delete(stored);
        }
      }
    },
    importing: () => !released && imported.size > 0,
    release: () => {
      released = true;
      raster.releaseTiles();
      imported.clear();
    },
    save: async () => {
      let done = 0;
      for (const key of keysOf(raster.freshTiles()).sort((a, b) => Math.abs(a.step - viewStep()) - Math.abs(b.step - viewStep()))) {
        if (busy() || done >= SAVES_PER_PASS) {
          return false;
        }
        const at = keyOf(key, Basis.Shown);
        if (!at || saved.has(at.stored)) {
          continue;
        }
        const pixels = await raster.readTile(key.step, key.tx, key.ty);
        if (!pixels || busy() || keyOf(key, Basis.Shown)?.stored !== at.stored) {
          continue;
        }
        saved.add(at.stored);
        const { blob, ms } = await codec.encode(pixels);
        encoded(ms, blob.size, key);
        await store.put(at.stored, blob);
        done++;
      }
      return true;
    }
  };
}
