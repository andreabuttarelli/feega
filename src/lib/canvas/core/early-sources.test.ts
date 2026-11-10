import { describe, expect, it } from 'vitest';
import { earlySourceUrls } from './early-sources';

const row = (id: string, x: number, revision = 3) => ({ id, type: 'motion', position: { x, y: 0, z: 0 }, size: { width: 100, height: 100 }, data: { docHeadRevision: revision } });
const place = { projectId: 'p', canvasId: 'c' };
const screen = { width: 400, height: 300 };

describe('earlySourceUrls', () => {
  it('asks the on-screen frames, nearest the centre first, with the url the renderer reads', () => {
    const saved = { x: 0, y: 0, zoom: 1 };
    const urls = earlySourceUrls([row('far', 250), row('near', 150), row('off', 5000)], place, saved, screen);
    expect(urls).toEqual(['/p/p/c/c/motion/near/source?revision=3', '/p/p/c/c/motion/far/source?revision=3']);
  });

  it('skips rows that hold no saved doc', () => {
    expect(earlySourceUrls([row('draft', 0, 0)], place, null, screen)).toEqual([]);
  });
});
