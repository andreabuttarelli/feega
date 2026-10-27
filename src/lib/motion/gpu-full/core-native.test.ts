// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachedOf, backgroundOf, createCoreNative, openHole, type NativeCanvasBridge } from '@feega/motion-core/motion/gpu-full/core-native';

function fakeBridge(report = '{"report":"idle","pending":false,"cacheBytes":0}') {
  const calls: [string, ...unknown[]][] = [];
  const log =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
    };
  const bridge: NativeCanvasBridge = {
    attach: vi.fn(async (...args: unknown[]) => void calls.push(['attach', ...args])),
    picture: log('picture'),
    putGroup: log('putGroup'),
    appendGroup: log('appendGroup'),
    patchGroup: log('patchGroup'),
    dropGroup: log('dropGroup'),
    patchUses: log('patchUses'),
    setOverlay: log('setOverlay'),
    tick: log('tick'),
    place: log('place'),
    report: () => report,
    stats: async () => null,
    close: log('close')
  };
  return { bridge, calls };
}

const rgba = (_source: unknown, width: number, height: number) => new ArrayBuffer(width * height * 4);

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as { feegaNativeCanvas?: unknown }).feegaNativeCanvas;
});

describe('the native engine behind the same seam as the wasm one', () => {
  it('sends the camera once, then only asks for frames while it stays put', () => {
    const { bridge, calls } = fakeBridge();
    const attached = attachedOf(bridge, rgba);

    attached.set_camera(10, 20, 2);
    attached.frame(0);
    attached.set_camera(10, 20, 2);
    attached.frame(16);

    expect(calls.filter(([name]) => name === 'tick')).toEqual([['tick', { x: 10, y: 20, zoom: 2 }], ['tick', null]]);
  });

  it('answers a frame with the last report the render thread pushed, without waiting for it', () => {
    const { bridge } = fakeBridge('{"report":"partial\\nph0 unsupported","pending":true,"cacheBytes":2048}');
    const attached = attachedOf(bridge, rgba);

    expect(attached.frame(0)).toBe('partial\nph0 unsupported');
    expect(attached.cache_pending()).toBe(true);
    expect(attached.cache_bytes()).toBe(2048);
  });

  it('answers idle before the render thread has said anything', () => {
    const { bridge } = fakeBridge('');
    const attached = attachedOf(bridge, rgba);

    expect(attached.frame(0)).toBe('idle');
    expect(attached.cache_pending()).toBe(false);
  });

  it('patches a group only from one it sent, as the wasm library refuses an unknown base', () => {
    const { bridge, calls } = fakeBridge();
    const attached = attachedOf(bridge, rgba);

    expect(attached.patch_group('a', 'b', '{}')).toBe(false);
    attached.put_group('a', '{}');
    expect(attached.patch_group('a', 'b', '{}')).toBe(true);
    attached.append_group('c', '{}');
    expect(attached.patch_group('c', 'd', '{}')).toBe(true);

    expect(calls.filter(([name]) => name === 'patchGroup')).toEqual([['patchGroup', 'a', 'b', '{}'], ['patchGroup', 'c', 'd', '{}']]);
  });

  it('forgets a dropped group', () => {
    const { bridge } = fakeBridge();
    const attached = attachedOf(bridge, rgba);

    attached.put_group('a', '{}');
    attached.drop_group('a');

    expect(attached.patch_group('a', 'b', '{}')).toBe(false);
  });

  it('hands a picture over as straight RGBA bytes, not as a browser object', () => {
    const { bridge, calls } = fakeBridge();
    const attached = attachedOf(bridge, rgba);

    attached.picture('photo', { width: 2, height: 1 }, 2, 1);

    const [, clip, bytes, width, height] = calls.find(([name]) => name === 'picture')!;
    expect([clip, (bytes as ArrayBuffer).byteLength, width, height]).toEqual(['photo', 8, 2, 1]);
  });

  it('refuses a one-shot draw, which only the exporter uses', () => {
    const { bridge } = fakeBridge();

    expect(() => attachedOf(bridge, rgba).draw('{}')).toThrow(/export/);
  });
});

describe('the page over the native layer', () => {
  it('reads the colour the canvas stands on from the nearest opaque ancestor', () => {
    document.body.innerHTML = '<div style="background-color: rgb(12, 34, 56)"><section><canvas></canvas></section></div>';

    expect(backgroundOf(document.querySelector('canvas')!)).toEqual([12 / 255, 34 / 255, 56 / 255]);
  });

  it('falls back to white when nothing above the canvas paints', () => {
    document.body.innerHTML = '<canvas></canvas>';

    expect(backgroundOf(document.querySelector('canvas')!)).toEqual([1, 1, 1]);
  });

  it('turns every ancestor transparent so the native view shows through, and puts them back', () => {
    document.body.innerHTML = '<div id="outer" style="background: rgb(10, 10, 10)"><canvas></canvas></div>';
    const canvas = document.querySelector('canvas')!;

    const close = openHole(canvas);

    expect(document.querySelector('#outer')!.hasAttribute('data-native-hole')).toBe(true);
    expect(document.head.querySelector('style[data-native-canvas]')!.textContent).toContain('background-color: transparent !important');

    close();

    expect(document.querySelector('#outer')!.hasAttribute('data-native-hole')).toBe(false);
    expect(document.head.querySelector('style[data-native-canvas]')).toBeNull();
  });
});

describe('createCoreNative', () => {
  it('refuses when the shell offers no native canvas, so the caller falls back to wasm', async () => {
    await expect(createCoreNative(document.createElement('canvas'), 100, 100)).rejects.toThrow(/native canvas unavailable/);
  });

  it('rejects when the addon cannot attach, leaving the page as it was', async () => {
    const { bridge } = fakeBridge();
    bridge.attach = vi.fn(async () => {
      throw new Error('no metal device');
    });
    (window as { feegaNativeCanvas?: NativeCanvasBridge }).feegaNativeCanvas = bridge;
    document.body.innerHTML = '<div id="outer"><canvas></canvas></div>';

    await expect(createCoreNative(document.querySelector('canvas')!, 100, 100)).rejects.toThrow('no metal device');

    expect(document.querySelector('#outer')!.hasAttribute('data-native-hole')).toBe(false);
  });

  it('closes the native layer and restores the page on dispose', async () => {
    const { bridge, calls } = fakeBridge();
    (window as { feegaNativeCanvas?: NativeCanvasBridge }).feegaNativeCanvas = bridge;
    document.body.innerHTML = '<div id="outer"><canvas></canvas></div>';

    const raster = await createCoreNative(document.querySelector('canvas')!, 100, 100);
    expect(raster.behindPage).toBe(true);
    expect(document.querySelector('#outer')!.hasAttribute('data-native-hole')).toBe(true);

    raster.dispose();

    expect(calls.some(([name]) => name === 'close')).toBe(true);
    expect(document.querySelector('#outer')!.hasAttribute('data-native-hole')).toBe(false);
  });
});
