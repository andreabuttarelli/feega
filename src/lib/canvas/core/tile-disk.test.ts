import { describe, expect, it } from 'vitest';
import { tileDisk, type DiskRaster } from './tile-disk';
import { Basis, type TileLayer, type TileLook } from './tile-cache';
import type { TileStore } from './tile-store';
import type { TileCodec } from './tile-codec';

const LOOK: TileLook = { canvasId: 'c1', paper: '#fff', line: '#eee', resolution: 1 };
const CAMERA = { x: 0, y: 0, zoom: 1 };
const SCREEN = { width: 256, height: 256 };

function fakeStore(): TileStore & { keys: () => string[] } {
  const blobs = new Map<string, Blob>();
  return {
    get: async (key) => blobs.get(key) ?? null,
    put: async (key, blob) => void blobs.set(key, blob),
    dropCanvas: async () => blobs.clear(),
    bytes: async () => 0,
    keys: () => [...blobs.keys()]
  };
}

const encodedPixels = new WeakMap<Blob, Uint8Array>();
const codec: TileCodec = {
  encode: async (pixels) => {
    const blob = new Blob([]);
    encodedPixels.set(blob, pixels.slice());
    return { blob, ms: 1 };
  },
  decode: async (blob) => encodedPixels.get(blob)!
};

function fakeRaster() {
  const held = new Map<string, Uint8Array>();
  const imported = new Set<string>();
  const forgotten: string[] = [];
  const settled: string[] = [];
  const id = (step: number, tx: number, ty: number) => `${step}_${tx}_${ty}`;
  const raster: DiskRaster & { held: typeof held; imported: typeof imported; forgotten: string[]; settled: string[] } = {
    held,
    imported,
    forgotten,
    settled,
    settleTile: (step, tx, ty) => void settled.push(id(step, tx, ty)),
    freshTiles: () => [...held.keys()].filter((k) => !imported.has(k)).flatMap((k) => k.split('_').map(Number)),
    readTile: (step, tx, ty) => Promise.resolve(held.get(id(step, tx, ty))!.slice()),
    putTile: (step, tx, ty, pixels) => {
      held.set(id(step, tx, ty), pixels);
      imported.add(id(step, tx, ty));
      return true;
    },
    forgetTile: (step, tx, ty) => void forgotten.push(id(step, tx, ty)),
    releaseTiles: () => imported.clear()
  };
  return raster;
}

const frameAt = (revision: number): TileLayer[] => [{ id: 'a', content: `a:${revision}`, box: { x: 0, y: 0, w: 100, h: 100 } }];

async function savedOnce(store: TileStore, revision: number) {
  const raster = fakeRaster();
  raster.held.set('0_0_0', new Uint8Array([1, 2, 3, 4]));
  await tileDisk({ store, codec, raster, look: () => LOOK, layers: () => frameAt(revision), busy: () => false, viewStep: () => 0 }).save();
}

describe('tile disk cache', () => {
  it('reopening shows the saved tile as held', async () => {
    const store = fakeStore();
    await savedOnce(store, 1);
    const raster = fakeRaster();

    const restored = await tileDisk({ store, codec, raster, look: () => LOOK, layers: () => frameAt(1), busy: () => false, viewStep: () => 0 }).restore(CAMERA, SCREEN);

    expect(restored).toMatchObject({ count: 1, covered: true });
    expect([...raster.held.get('0_0_0')!]).toEqual([1, 2, 3, 4]);
  });

  it('an edited frame never shows its stale cached tile', async () => {
    const store = fakeStore();
    await savedOnce(store, 1);
    const raster = fakeRaster();

    await tileDisk({ store, codec, raster, look: () => LOOK, layers: () => frameAt(2), busy: () => false, viewStep: () => 0 }).restore(CAMERA, SCREEN);

    expect(raster.held.size).toBe(0);
  });

  it('an edit while loading forgets the imported tile', async () => {
    const store = fakeStore();
    await savedOnce(store, 1);
    const raster = fakeRaster();
    let revision = 1;
    const disk = tileDisk({ store, codec, raster, look: () => LOOK, layers: () => frameAt(revision), busy: () => false, viewStep: () => 0 });
    await disk.restore(CAMERA, SCREEN);

    revision = 2;
    disk.check();

    expect(raster.forgotten).toEqual(['0_0_0']);
  });

  it('saves nothing during a gesture', async () => {
    const store = fakeStore();
    const raster = fakeRaster();
    raster.held.set('0_0_0', new Uint8Array(4));

    await tileDisk({ store, codec, raster, look: () => LOOK, layers: () => frameAt(1), busy: () => true, viewStep: () => 0 }).save();

    expect(store.keys()).toEqual([]);
  });

  it('saves nothing over a frame not yet shown whole', async () => {
    const store = fakeStore();
    const raster = fakeRaster();
    raster.held.set('0_0_0', new Uint8Array(4));
    const layers = (basis: Basis) => frameAt(1).map((l) => (basis === Basis.Shown ? { ...l, content: null } : l));

    await tileDisk({ store, codec, raster, look: () => LOOK, layers, busy: () => false, viewStep: () => 0 }).save();

    expect(store.keys()).toEqual([]);
  });

  it('imports nothing once the frames are loaded', async () => {
    const store = fakeStore();
    await savedOnce(store, 1);
    const raster = fakeRaster();
    const disk = tileDisk({ store, codec, raster, look: () => LOOK, layers: () => frameAt(1), busy: () => false, viewStep: () => 0 });

    disk.release();

    expect(await disk.restore(CAMERA, SCREEN)).toMatchObject({ count: 0, covered: false });
  });

  it('a view with a frame missing from the cache is not covered', async () => {
    const store = fakeStore();
    await savedOnce(store, 1);
    const twoFrames = [...frameAt(1), { id: 'b', content: 'b:1', box: { x: 300, y: 0, w: 100, h: 100 } }];

    const restored = await tileDisk({ store, codec, raster: fakeRaster(), look: () => LOOK, layers: () => twoFrames, busy: () => false, viewStep: () => 0 }).restore(CAMERA, { width: 512, height: 256 });

    expect(restored.covered).toBe(false);
  });

  it('a region whose frames are shown whole hands its tiles back to the engine', async () => {
    const store = fakeStore();
    await savedOnce(store, 1);
    const raster = fakeRaster();
    let whole = false;
    const layers = (basis: Basis) => frameAt(1).map((l) => (basis === Basis.Shown && !whole ? { ...l, content: null } : l));
    const disk = tileDisk({ store, codec, raster, look: () => LOOK, layers, busy: () => false, viewStep: () => 0 });
    await disk.restore(CAMERA, SCREEN);

    disk.settle();
    expect(raster.settled).toEqual([]);
    whole = true;
    disk.settle();

    expect(raster.settled).toEqual(['0_0_0']);
    expect(raster.forgotten).toEqual([]);
    expect(disk.importing()).toBe(false);
  });

  it('names the restored tiles so frames under them count as drawn', async () => {
    const store = fakeStore();
    await savedOnce(store, 1);

    const restored = await tileDisk({ store, codec, raster: fakeRaster(), look: () => LOOK, layers: () => frameAt(1), busy: () => false, viewStep: () => 0 }).restore(CAMERA, SCREEN);

    expect(restored.view).toEqual([{ step: 0, tx: 0, ty: 0 }]);
  });
});
