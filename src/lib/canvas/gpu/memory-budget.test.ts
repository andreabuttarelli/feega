import { describe, expect, it } from 'vitest';
import { Device, BUDGET, previewHtml } from './memory-budget';

describe('memory budget', () => {
  it('a phone gets a smaller texture budget than a desktop', () => {
    expect(BUDGET[Device.Phone].textureBytes).toBeLessThan(BUDGET[Device.Desktop].textureBytes);
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
