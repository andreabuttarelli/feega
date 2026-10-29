import { describe, expect, it } from 'vitest';
import { isProduceApproved, markProduceApproved, type PreviewPost } from './media-generate.images';

describe('isProduceApproved', () => {
  it('is false for a plain post array', () => {
    const posts: PreviewPost[] = [{ imageUrl: 'hi' }];
    expect(isProduceApproved(posts)).toBe(false);
  });

  it('survives rebuilding a produced[] via onPost-style push of the same post refs', () => {
    const posts: PreviewPost[] = [
      { imageUrl: 'a' },
      { imageUrl: 'b' }
    ];
    markProduceApproved(posts, true);
    expect(isProduceApproved(posts)).toBe(true);

    // Scheduler / generatePreview rebuild: only push post objects into a new array.
    const produced: PreviewPost[] = [];
    for (const p of posts) produced.push(p);
    expect(isProduceApproved(produced)).toBe(true);
  });

  it('is false when produce did not approve', () => {
    const posts: PreviewPost[] = [{ imageUrl: 'hi' }];
    markProduceApproved(posts, false);
    const produced = [...posts];
    expect(isProduceApproved(produced)).toBe(false);
  });
});
