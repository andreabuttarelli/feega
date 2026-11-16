import { describe, expect, it } from 'vitest';
import { Again, paintAgain } from './paint-again';

const still = { pending: false, warming: false, warmWait: 0, zooming: false, overlayWaiting: false, sceneBusy: false };

describe('when the canvas paints again', () => {
  it('stops when nothing is left to do', () => {
    expect(paintAgain(still)).toEqual({ at: Again.Never });
  });

  it('waits for the tiles to warm instead of painting every frame until then', () => {
    expect(paintAgain({ ...still, warming: true, warmWait: 400 })).toEqual({ at: Again.Later, ms: 400 });
  });

  it('paints the next frame while warming has work to do now', () => {
    expect(paintAgain({ ...still, warming: true, warmWait: 0 })).toEqual({ at: Again.Frame });
  });

  it('paints the next frame for pending work even while waiting to warm', () => {
    expect(paintAgain({ ...still, pending: true, warming: true, warmWait: 400 })).toEqual({ at: Again.Frame });
    expect(paintAgain({ ...still, zooming: true, warming: true, warmWait: 400 })).toEqual({ at: Again.Frame });
    expect(paintAgain({ ...still, sceneBusy: true })).toEqual({ at: Again.Frame });
    expect(paintAgain({ ...still, overlayWaiting: true })).toEqual({ at: Again.Frame });
  });
});
