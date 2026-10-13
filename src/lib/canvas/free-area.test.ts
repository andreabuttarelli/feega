import { describe, expect, it } from 'vitest';
import { fitPadding, freeArea } from './free-area';

const SCREEN = { width: 1280, height: 720 };

describe('free area', () => {
  it('leaves out the bar on top, the timeline below and the column on the right', () => {
    const panels = [
      { left: 0, top: 0, right: 1280, bottom: 44 },
      { left: 0, top: 360, right: 880, bottom: 720 },
      { left: 880, top: 44, right: 1280, bottom: 720 }
    ];

    expect(freeArea(SCREEN, panels)).toEqual({ top: 44, right: 400, bottom: 360, left: 0 });
  });

  it('on a phone the bar is split in groups along the top, and the timeline is a band at the bottom', () => {
    const phone = { width: 390, height: 844 };
    const panels = [
      { left: 0, top: 0, right: 150, bottom: 56 },
      { left: 150, top: 0, right: 390, bottom: 56 },
      { left: 0, top: 400, right: 390, bottom: 720 },
      { left: 0, top: 720, right: 390, bottom: 844 }
    ];

    expect(freeArea(phone, panels)).toEqual({ top: 56, right: 0, bottom: 444, left: 0 });
  });

  it('ignores panels that are hidden and take no room', () => {
    expect(freeArea(SCREEN, [{ left: 0, top: 0, right: 0, bottom: 0 }])).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('frames the node inside what is left, with a margin', () => {
    expect(fitPadding({ top: 44, right: 400, bottom: 360, left: 0 })).toEqual({ top: '76px', right: '432px', bottom: '392px', left: '32px' });
  });
});
