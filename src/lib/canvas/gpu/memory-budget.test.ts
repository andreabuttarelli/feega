import { describe, expect, it } from 'vitest';
import { Device, BUDGET, decodeSize, previewHtml, rendererResolution } from './memory-budget';
import { bytesOf } from './texture-bytes';

const MB = 1024 * 1024;

const HEAVY_CANVAS_IMAGES = [
  ...Array(3).fill([3574, 3574]),
  ...Array(12).fill([1080, 1080]),
  ...Array(20).fill([720, 1280]),
  ...Array(41).fill([1920, 1080]),
  ...Array(23).fill([600, 600])
] as [number, number][];

const totalOn = (device: Device) =>
  HEAVY_CANVAS_IMAGES.reduce((sum, [w, h]) => {
    const s = decodeSize(w, h, device);
    return sum + bytesOf({ pixelWidth: s.width, pixelHeight: s.height, autoGenerateMipmaps: true });
  }, 0);

describe('memory budget — a heavy canvas fits an iPhone WebContent process', () => {
  it('a 3574 px image is decoded to the device edge, keeping its aspect', () => {
    expect(decodeSize(3574, 1787, Device.Phone)).toEqual({ width: BUDGET[Device.Phone].decodeEdge, height: BUDGET[Device.Phone].decodeEdge / 2 });
    expect(decodeSize(300, 200, Device.Phone)).toEqual({ width: 300, height: 200 });
  });

  it('the 99 images of the heavy canvas fit the phone texture budget once decoded to size', () => {
    expect(totalOn(Device.Phone)).toBeLessThanOrEqual(BUDGET[Device.Phone].textureBytes);
    expect(BUDGET[Device.Phone].textureBytes).toBeLessThanOrEqual(160 * MB);
  });

  it('a DPR 3 phone renders at 2, a desktop at its own ratio', () => {
    expect(rendererResolution(3, Device.Phone)).toBe(2);
    expect(rendererResolution(1, Device.Phone)).toBe(1);
    expect(rendererResolution(3, Device.Desktop)).toBe(3);
  });

  it('a phone mounts no off-screen tile to shoot posters or snapshots', () => {
    expect(BUDGET[Device.Phone].posterShelf).toBe(0);
    expect(BUDGET[Device.Phone].shootsSnapshots).toBe(false);
  });

  it('a phone renders without MSAA, which quadruples the backing store', () => {
    expect(BUDGET[Device.Phone].antialias).toBe(false);
  });

  it('a phone preview drops the will-change hints that made a 274-clip frame 1.7 GB of GPU layers', () => {
    const html = '<html><head><style>.fx{will-change:transform,opacity}</style></head><body><div class="fx"></div></body></html>';
    expect(previewHtml(html, Device.Desktop)).toBe(html);
    expect(previewHtml(html, Device.Phone)).toContain('will-change:auto!important');
    expect(previewHtml(html, Device.Phone).replace('<style>*{will-change:auto!important}</style>', '')).toBe(html);
  });
});
