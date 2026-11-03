import { describe, expect, it } from 'vitest';
import { DEFAULT_OVERLAY, OverlayPosition } from '@feega/motion-core/motion/prototype/model';
import { overlayBox } from './overlay-place';

const PHONE = { width: 390, height: 844 };
const SHEET = { width: 390, height: 300 };
const CARD = { width: 300, height: 200 };

describe('overlayBox', () => {
  it('centres the overlay at its own size over the frame', () => {
    expect(overlayBox(PHONE, CARD, DEFAULT_OVERLAY)).toEqual({ left: 45 / 390, top: 322 / 844, width: 300 / 390, height: 200 / 844 });
  });

  it('pins a top overlay to the top edge and a bottom one to the bottom edge', () => {
    expect(overlayBox(PHONE, SHEET, { ...DEFAULT_OVERLAY, position: OverlayPosition.Top })).toEqual({ left: 0, top: 0, width: 1, height: 300 / 844 });
    expect(overlayBox(PHONE, SHEET, { ...DEFAULT_OVERLAY, position: OverlayPosition.Bottom })).toEqual({ left: 0, top: 544 / 844, width: 1, height: 300 / 844 });
  });

  it('places a manual overlay at its offset from the top left of the frame', () => {
    expect(overlayBox(PHONE, CARD, { ...DEFAULT_OVERLAY, position: OverlayPosition.Manual, x: 39, y: 211 })).toEqual({ left: 39 / 390, top: 211 / 844, width: 300 / 390, height: 200 / 844 });
  });

  it('shrinks an overlay bigger than the frame until it fits', () => {
    const box = overlayBox(PHONE, { width: 780, height: 844 }, DEFAULT_OVERLAY);

    expect(box).toEqual({ left: 0, top: 0.25, width: 1, height: 0.5 });
  });
});
