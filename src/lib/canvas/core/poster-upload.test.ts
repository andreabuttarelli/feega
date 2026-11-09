import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POSTER_MIN_PX, posterUploads, type Shot } from './poster-upload';

const WAIT = 1000;
const blob = new Blob(['x'], { type: 'image/webp' });
const shot = (over: Partial<Shot> = {}): Shot => ({ id: 'f1', revision: 5, posterRevision: 4, blob, width: 512, height: 300, ...over });

describe('a frame poster from the canvas thumbnail', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('uploads the thumbnail of a saved revision the poster does not show yet (cold opens drew nothing until the frame was built)', async () => {
    const sent: Shot[] = [];
    const offer = posterUploads(async (s) => void sent.push(s), WAIT);

    offer(shot());
    await vi.advanceTimersByTimeAsync(WAIT);

    expect(sent.map((s) => [s.id, s.revision])).toEqual([['f1', 5]]);
  });

  it('sends only the last revision of a burst of saves', async () => {
    const sent: Shot[] = [];
    const offer = posterUploads(async (s) => void sent.push(s), WAIT);

    offer(shot({ revision: 5 }));
    offer(shot({ revision: 6 }));
    await vi.advanceTimersByTimeAsync(WAIT);

    expect(sent.map((s) => s.revision)).toEqual([6]);
  });

  it('skips a fresh poster, a revision already sent, and a thumbnail too small to stand for the frame', async () => {
    const sent: Shot[] = [];
    const offer = posterUploads(async (s) => void sent.push(s), WAIT);

    offer(shot({ posterRevision: 5 }));
    offer(shot({ id: 'tiny', width: POSTER_MIN_PX - 1 }));
    offer(shot({ id: 'f2' }));
    await vi.advanceTimersByTimeAsync(WAIT);
    offer(shot({ id: 'f2' }));
    await vi.advanceTimersByTimeAsync(WAIT);

    expect(sent.map((s) => s.id)).toEqual(['f2']);
  });
});
