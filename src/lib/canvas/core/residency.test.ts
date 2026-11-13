import { describe, expect, it } from 'vitest';
import { ItemKind, type Item } from '@feega/motion-core/motion/gpu-full/display-list';
import { CACHE_SHARE, cacheZoom, cached, Offscreen, pictureBytes, resident, heldWhileEdited, heldWhileMoving, movingWhileZooming, uncached, ZoomPicture } from './residency';

const view = { x: 0, y: 0, zoom: 1 };
const screen = { width: 1000, height: 1000 };
const frame = (id: string, x: number, images: number, imageEdge = 100) => ({ id, group: `${id}:1`, box: { x, y: 0, w: 100, h: 100 }, size: { width: 100, height: 100 }, bytes: images * imageEdge * imageEdge * 4 });

describe('frame residency', () => {
  it('a phone drops offscreen frames with images instead of keeping them up to the budget', () => {
    expect(resident([frame('on', 0, 1), frame('off', 9000, 1)], view, screen, 1e9, Offscreen.Dropped).map((f) => f.id)).toEqual(['on']);
  });

  it('vector frames stay resident wherever they are', () => {
    expect(resident([frame('v', 9000, 0)], view, screen, 0).map((f) => f.id)).toEqual(['v']);
  });

  it('media frames off screen stay resident while the budget allows, so a pan never reveals an empty frame', () => {
    expect(resident([frame('on', 0, 1), frame('off', 9000, 1)], view, screen, 1e9).map((f) => f.id)).toEqual(['on', 'off']);
  });

  it('over budget, frames on screen and nearest to it keep their pictures first', () => {
    const bytes = 100 * 100 * 4;
    expect(resident([frame('far', 9000, 1), frame('near', 1500, 1), frame('on', 0, 1)], view, screen, 2 * bytes).map((f) => f.id)).toEqual(['near', 'on']);
  });

  it('counts the bytes of its pictures, not its whole doc once per picture', () => {
    const tall = { ...frame('landing', 0, 0), size: { width: 1440, height: 5000 }, bytes: 2 * 400 * 300 * 4 };
    expect(resident([tall], view, screen, 1_000_000).map((f) => f.id)).toEqual(['landing']);
  });

  it('over budget, media frames beyond it are left out', () => {
    const bytes = 100 * 100 * 4;
    expect(resident([frame('a', 0, 1), frame('b', 200, 1)], view, screen, bytes).length).toBe(1);
  });

  it('caches frames whose texture at the current zoom fits the cache share of the budget', () => {
    const texture = 200 * 200 * 4;
    const frames = [frame('media', 0, 1), frame('a', 200, 0), frame('b', 400, 0)];

    expect(cached(frames, { x: 0, y: 0, zoom: 2 }, screen, texture / CACHE_SHARE).map((f) => f.cache)).toEqual([true, false, false]);
    expect(cached(frames, { x: 0, y: 0, zoom: 2 }, screen, (3 * texture) / CACHE_SHARE).every((f) => f.cache)).toBe(true);
  });

  it('sizes cache textures at the top of the zoom step, so a zoom within the step never outgrows the budget', () => {
    const texture = 200 * 200 * 4;
    const frames = [frame('a', 0, 0), frame('b', 200, 0)];
    const zoom = 1.9;

    expect(cacheZoom(zoom)).toBeGreaterThanOrEqual(zoom);
    expect(cacheZoom(zoom)).toBe(cacheZoom(zoom * 1.01));
    expect(cached(frames, { x: 0, y: 0, zoom }, screen, (2 * texture - 1) / CACHE_SHARE, cacheZoom(zoom)).map((f) => f.cache)).toEqual([true, false]);
    expect(cached(frames, { x: 0, y: 0, zoom }, screen, (2 * texture - 1) / CACHE_SHARE).map((f) => f.cache)).toEqual([true, true]);
  });
});

describe('a view at rest', () => {
  it('draws every frame from its vectors, never from a cache texture, so it is crisp at the current zoom', () => {
    const shown = cached([frame('a', 0, 0), frame('b', 200, 0)], view, screen, 1e9);

    expect(shown.every((f) => f.cache)).toBe(true);
    expect(uncached(shown).every((f) => !f.cache)).toBe(true);
  });
});

describe('a node under a live edit', () => {
  it('holds its texture so each step only stretches its use, never re-rasters', () => {
    const shown = cached([frame('a', 0, 0), frame('b', 200, 0)], view, screen, 1e9);
    expect(heldWhileEdited(shown, new Set(['a'])).map((f) => [f.id, f.cache, f.hold])).toEqual([
      ['a', true, true],
      ['b', true, undefined]
    ]);
  });

  it('is cached even past the texture budget, so a heavy frame is not redrawn item by item each step', () => {
    const shown = cached([frame('a', 0, 1, 2000)], view, screen, 0);
    expect(heldWhileEdited(shown, new Set(['a']))[0]).toMatchObject({ cache: true, hold: true });
  });
});

describe('a frame being dragged', () => {
  it('holds every frame on screen as a texture, so the drag repaints textures instead of pages', () => {
    const shown = cached([frame('a', 0, 0), frame('b', 200, 0)], view, screen, 1e9);
    expect(heldWhileMoving(shown, new Set(['a'])).map((f) => [f.id, f.hold])).toEqual([
      ['a', true],
      ['b', true]
    ]);
  });

  it('holds nothing while nothing moves', () => {
    const shown = cached([frame('a', 0, 0)], view, screen, 1e9);
    expect(heldWhileMoving(shown, new Set())[0].hold).toBeUndefined();
  });
});

describe('a zoom gesture', () => {
  const shown = [frame('a', 0, 0), frame('b', 200, 0)];

  it('holds every frame as a texture where pictures are held, so a pinch never re-rasters whole pages each frame', () => {
    expect([...movingWhileZooming(shown, new Set(), ZoomPicture.Held)]).toEqual(['a', 'b']);
  });

  it('keeps the exact picture where it is exact, moving only what an edit or a drag moves', () => {
    expect([...movingWhileZooming(shown, new Set(['b']), ZoomPicture.Exact)]).toEqual(['b']);
  });
});

describe('picture bytes', () => {
  const counted = () => {
    const reads = { n: 0 };
    const image = { size: { width: 10, height: 10 } } as Item;
    Object.defineProperty(image, 'kind', { get: () => (reads.n++, ItemKind.Image) });
    return { items: [image] as readonly Item[], reads };
  };

  it('counts four bytes per image pixel', () => {
    expect(pictureBytes(counted().items)).toBe(400);
  });

  it('walks a list once, however many frames ask for it during a gesture', () => {
    const { items, reads } = counted();
    pictureBytes(items);
    pictureBytes(items);
    expect(reads.n).toBe(1);
  });
});
