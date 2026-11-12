import { describe, expect, it } from 'vitest';
import { blankSample, wasInGesture } from './crash-record';
import { Motion, gauged, heldBy, track, type Tick } from './crash-watch';

const tick = (over: Partial<Tick>): Tick => ({ x: 0, y: 0, zoom: 1, now: 0, motion: Motion.Moving, rastered: false, ...over });

describe('the live sample', () => {
  it('measures zoom speed in doublings per second and pan speed in px per second', () => {
    const s = blankSample();
    track(s, tick({ now: 0 }));
    track(s, tick({ now: 500, zoom: 2, x: 100 }));

    expect(s.zoomPerSecond).toBeCloseTo(2);
    expect(s.panPerSecond).toBeCloseTo(200);
  });

  it('counts frames since the gesture started and restarts when it stops', () => {
    const s = blankSample();
    track(s, tick({ now: 0 }));
    track(s, tick({ now: 16 }));
    expect(s.gestureFrames).toBe(2);

    track(s, tick({ now: 32, motion: Motion.Still }));
    expect(s.gestureFrames).toBe(0);
  });

  it('remembers the zoom of the last raster', () => {
    const s = blankSample();
    track(s, tick({ now: 0, zoom: 1.5, rastered: true }));
    track(s, tick({ now: 16, zoom: 3 }));

    expect(s.rasterZoom).toBe(1.5);
    expect(s.zoom).toBe(3);
  });
});

describe("which crash records are worth sending", () => {
  it("only those written during a gesture", () => {
    expect(wasInGesture({ ...blankSample(), gestureFrames: 3 })).toBe(true);
    expect(wasInGesture({ ...blankSample(), gestureFrames: 0 })).toBe(false);
  });
});

describe('gauged', () => {
  const gpu = { textureBytes: 5, textures: 1, bufferBytes: 0, buffers: 0, created: 2, submits: 3, lagMs: 0, wasm: [], queue: null, polling: false };
  const raster = { cacheBytes: 1, pictureBytes: 2, scratchBytes: 4, wasmBytes: 8, width: 780, height: 1688 };

  it('reads the drawing buffer size every tick, not the area seen at mount', () => {
    const s = blankSample();
    s.canvas = '0x0';
    gauged(s, gpu, raster);
    expect(s.canvas).toBe('780x1688');
  });

  it('keeps the GPU buffer bytes, which the death on 2026-11-12 never reported', () => {
    const s = blankSample();
    gauged(s, { ...gpu, bufferBytes: 224 * 1024 * 1024, buffers: 40 }, raster);
    expect(s.bufferBytes).toBe(224 * 1024 * 1024);
    expect(s.buffers).toBe(40);
  });

  it('takes the core memory and scratch textures from the raster when the probe missed the wasm load', () => {
    const s = blankSample();
    gauged(s, gpu, raster);
    expect(s.wasmBytes).toBe(8);
    expect(s.scratchBytes).toBe(4);
  });
});

describe('what a session held', () => {
  it('reads in megabytes to one decimal', () => {
    const s = { ...blankSample(), textureBytes: 150 * 1024 * 1024 + 60_000, textures: 12, bufferBytes: 224 * 1024 * 1024, wasmBytes: 64 * 1024 * 1024 };

    expect(heldBy(s)).toEqual({ textureMb: 150.1, textures: 12, bufferMb: 224, wasmMb: 64, cacheMb: 0, pictureMb: 0 });
  });
});
