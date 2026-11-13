import { describe, expect, it } from 'vitest';
import { Offscreen, ZoomPicture } from '$lib/canvas/core/residency';
import { Device, BUDGET, buildLanes, deviceOf, previewHtml, textureBudget } from './memory-budget';

describe('memory budget', () => {
  it('the texture budget follows the canvas size, up to the device ceiling', () => {
    const small = textureBudget(BUDGET[Device.Desktop].textureBytes, { width: 1280, height: 800 });
    const large = textureBudget(BUDGET[Device.Desktop].textureBytes, { width: 7680, height: 4320 });

    expect(small).toBeLessThan(BUDGET[Device.Desktop].textureBytes);
    expect(small).toBeGreaterThan(1280 * 800 * 4 * 6);
    expect(large).toBe(BUDGET[Device.Desktop].textureBytes);
  });

  it('a phone gets a smaller texture budget than a desktop', () => {
    expect(BUDGET[Device.Phone].textureBytes).toBeLessThan(BUDGET[Device.Desktop].textureBytes);
  });

  it('a phone decodes pictures smaller than a desktop, and neither backs the canvas past 2x', () => {
    expect(BUDGET[Device.Phone].pictureSide).toBeLessThan(BUDGET[Device.Desktop].pictureSide);
    expect(Math.max(BUDGET[Device.Phone].resolution, BUDGET[Device.Desktop].resolution)).toBeLessThanOrEqual(2);
  });

  it('a phone zooms held pictures and a desktop keeps zooming the exact page', () => {
    expect(BUDGET[Device.Phone].zoomPicture).toBe(ZoomPicture.Held);
    expect(BUDGET[Device.Desktop].zoomPicture).toBe(ZoomPicture.Exact);
  });

  it('a desktop browser with little memory gets the phone budget', () => {
    expect(deviceOf({ touch: false, memoryGb: 2 })).toBe(Device.Phone);
    expect(deviceOf({ touch: false, memoryGb: 8 })).toBe(Device.Desktop);
    expect(deviceOf({ touch: false })).toBe(Device.Desktop);
    expect(deviceOf({ touch: true, memoryGb: 8 })).toBe(Device.Phone);
  });

  const clips = (n: number) => `<html><head><style>.fx{will-change:transform,opacity}</style></head><body>${'<div class="fx"><div class="kf c1"></div></div>'.repeat(n / 2)}</body></html>`;
  const LANDING = { width: 1440, height: 4735 };
  const MOTION = { width: 1080, height: 1920 };

  it('a 274-clip landing drops the will-change hints that made it 1.7 GB of GPU layers on a phone and 2.6 s per edit on a desktop', () => {
    const html = clips(274);
    expect(previewHtml(html, LANDING)).toContain('will-change:auto!important');
    expect(previewHtml(html, LANDING).replace('<style>*{will-change:auto!important}</style>', '')).toBe(html);
  });

  it('a 110-clip motion frame keeps its layer hints, or playback repaints the whole frame every tick', () => {
    const html = clips(110);
    expect(previewHtml(html, MOTION)).toBe(html);
  });
});

describe('tile memory', () => {
  it('a phone or a low-memory machine keeps at most 128 MB of canvas tiles, a desktop more', () => {
    expect(BUDGET[deviceOf({ touch: false, memoryGb: 4 })].tileBytes).toBeLessThanOrEqual(128 * 1024 * 1024);
    expect(BUDGET[deviceOf({ touch: true })].tileBytes).toBeLessThanOrEqual(128 * 1024 * 1024);
    expect(BUDGET[deviceOf({ touch: false, memoryGb: 16 })].tileBytes).toBeGreaterThan(128 * 1024 * 1024);
  });
});

describe('device profile', () => {
  const MB = 1024 * 1024;

  it('a desktop keeps the values it had before phones got their own profile', () => {
    expect(BUDGET[Device.Desktop]).toEqual({ textureBytes: 256 * MB, tileBytes: 384 * MB, pictureSide: 4096, resolution: 2, framesInFlight: 6, retainMs: 15_000, buildLanes: 4, canvasTiles: 320, offscreen: Offscreen.Resident, zoomPicture: ZoomPicture.Exact, readableWidth: 0, builtBytes: Infinity });
  });

  it('a desktop builds frames on one lane per spare core, up to four', () => {
    expect(buildLanes(Device.Desktop, 16)).toBe(4);
    expect(buildLanes(Device.Desktop, 3)).toBe(2);
    expect(buildLanes(Device.Desktop, 1)).toBe(1);
  });

  it('a phone bakes no whole-canvas tiles and keeps no offscreen frames', () => {
    expect(BUDGET[Device.Phone].canvasTiles).toBe(0);
    expect(BUDGET[Device.Phone].offscreen).toBe(Offscreen.Dropped);
  });

  it('a phone keeps a bounded weight of frames built, a desktop keeps them all', () => {
    expect(BUDGET[Device.Phone].builtBytes).toBeLessThan(256 * 1024 * 1024);
    expect(BUDGET[Device.Desktop].builtBytes).toBe(Infinity);
  });

  it('a phone builds no frame too small to read, a desktop builds them all', () => {
    expect(BUDGET[Device.Phone].readableWidth).toBeGreaterThan(0);
    expect(BUDGET[Device.Desktop].readableWidth).toBe(0);
  });

  it('a phone builds frames on a single worker, however many cores it reports', () => {
    expect(buildLanes(Device.Phone, 8)).toBe(1);
  });
});
