import { describe, expect, it } from 'vitest';
import { Quality } from '../export-formats';
import { bitrateLadder, videoBitrate } from './bitrate';

const PORTRAIT = { width: 1080, height: 1920 };
const UHD = { width: 2160, height: 3840 };
const MBPS = 1_000_000;

describe('export bitrate', () => {
  it('una 1080x1920 a 30 fps in High chiede almeno 20 Mbps, non i 4,7 che ammorbidivano grana e linee', () => {
    expect(videoBitrate(PORTRAIT, 30, Quality.High)).toBeGreaterThanOrEqual(20 * MBPS);
  });

  it('cresce con la qualità, i fotogrammi al secondo e i pixel', () => {
    expect(videoBitrate(PORTRAIT, 30, Quality.Standard)).toBeLessThan(videoBitrate(PORTRAIT, 30, Quality.High));
    expect(videoBitrate(PORTRAIT, 30, Quality.High)).toBeLessThan(videoBitrate(PORTRAIT, 30, Quality.Max));
    expect(videoBitrate(PORTRAIT, 60, Quality.High)).toBeGreaterThan(videoBitrate(PORTRAIT, 30, Quality.High));
    expect(videoBitrate(UHD, 30, Quality.High)).toBeGreaterThan(videoBitrate(PORTRAIT, 30, Quality.High));
  });

  it('resta sotto il tetto che un encoder H.264 del browser accetta', () => {
    expect(videoBitrate(UHD, 60, Quality.Max)).toBeLessThanOrEqual(100 * MBPS);
  });

  it('se l’encoder rifiuta il bitrate scende di gradino, fino a Standard', () => {
    const ladder = bitrateLadder(PORTRAIT, 30, Quality.Max);
    expect(ladder[0]).toBe(videoBitrate(PORTRAIT, 30, Quality.Max));
    expect(ladder.at(-1)).toBe(videoBitrate(PORTRAIT, 30, Quality.Standard));
    expect([...ladder].sort((a, b) => b - a)).toEqual(ladder);
  });
});
