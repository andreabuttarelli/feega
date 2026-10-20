import { describe, expect, it } from 'vitest';
import { UPLOAD_BUDGET_MS, createUploadQueue } from './upload-queue';

function clock() {
  let t = 0;
  return { now: () => t, spend: (ms: number) => (t += ms) };
}

describe('the GPU upload queue', () => {
  it('uploads within the frame budget and leaves the rest for the next frames', () => {
    const c = clock();
    const done: string[] = [];
    const queue = createUploadQueue({ now: c.now, rank: () => 0 });
    for (const url of ['a', 'b', 'c', 'd']) {
      queue.push(url, () => {
        c.spend(UPLOAD_BUDGET_MS / 2);
        done.push(url);
      });
    }

    queue.drain();

    expect(done).toEqual(['a', 'b']);
    expect(queue.size()).toBe(2);
  });

  it('uploads one texture per frame even when that one alone is over the budget', () => {
    const c = clock();
    const done: string[] = [];
    const queue = createUploadQueue({ now: c.now, rank: () => 0 });
    queue.push('big', () => {
      c.spend(UPLOAD_BUDGET_MS * 3);
      done.push('big');
    });
    queue.push('next', () => done.push('next'));

    queue.drain();

    expect(done).toEqual(['big']);
  });

  it('uploads the texture nearest the viewport first', () => {
    const c = clock();
    const done: string[] = [];
    const distance: Record<string, number> = { far: 900, near: 10, mid: 300 };
    const queue = createUploadQueue({ now: c.now, rank: (url) => distance[url] });
    for (const url of ['far', 'near', 'mid']) {
      queue.push(url, () => {
        c.spend(UPLOAD_BUDGET_MS);
        done.push(url);
      });
    }

    queue.drain();
    queue.drain();
    queue.drain();

    expect(done).toEqual(['near', 'mid', 'far']);
  });
});
