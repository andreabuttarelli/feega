import { describe, expect, it, vi } from 'vitest';
import { snapQueue, type Snap, type SnapJob } from './canvas-snaps';

const job = (key: string, x: number, target = `/${key}`): SnapJob => ({ key, target, device: { w: 100, h: 100 }, x, y: 0, width: 100, height: 100 });

const VIEW = { scale: 1, x: 0, y: 0 };
const VIEWPORT = { w: 1000, h: 1000 };

type Pending = { key: string; resolve: (snap: Snap | null) => void };

const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await Promise.resolve();
  }
};

function setup(max = 2) {
  const pending: Pending[] = [];
  const started: string[] = [];
  const changed = vi.fn();
  const queue = snapQueue({
    max,
    capture: (j) => new Promise((resolve) => (started.push(j.key), pending.push({ key: j.key, resolve }))),
    changed
  });
  const finish = async (key: string, height = 2000) => {
    pending.find((p) => p.key === key)!.resolve({ url: `png:${key}`, height, capped: false });
    await flush();
  };

  return { queue, started, finish, changed, pending };
}

describe('snapQueue ordering', () => {
  it('starts the frames nearest the viewport centre first', () => {
    const { queue, started } = setup();

    queue.want([job('far', 4000), job('mid', 800), job('centre', 450)], VIEW, VIEWPORT);

    expect(started).toEqual(['centre', 'mid']);
  });

  it('puts frames on screen before frames off screen', () => {
    const { queue, started } = setup(1);

    queue.want([job('off', 5000), job('on', 880)], VIEW, VIEWPORT);

    expect(started).toEqual(['on']);
  });

  it('starts frames even when the canvas is zoomed far out', () => {
    const { queue, started } = setup();

    queue.want([job('a', 0), job('b', 100), job('c', 200)], { scale: 0.02, x: 0, y: 0 }, VIEWPORT);

    expect(started).toHaveLength(2);
  });

  it('never runs more than the maximum at once and starts the next as one finishes', async () => {
    const { queue, started, finish } = setup();
    queue.want([job('a', 0), job('b', 150), job('c', 300), job('d', 450)], VIEW, VIEWPORT);

    expect(started).toHaveLength(2);
    await finish(started[0]);

    expect(started).toHaveLength(3);
  });

  it('captures every frame in the end, however far', async () => {
    const { queue, started, finish } = setup();
    const jobs = Array.from({ length: 9 }, (_, i) => job(`f${i}`, i * 5000));
    queue.want(jobs, VIEW, VIEWPORT);

    while (queue.snaps.size < jobs.length) {
      await finish(started.find((key) => !queue.snaps.has(key))!);
    }

    expect(new Set(queue.snaps.keys())).toEqual(new Set(jobs.map((j) => j.key)));
  });

  it('follows the view: a later call reorders what starts next', async () => {
    const { queue, started, finish } = setup(1);
    const jobs = [job('a', 0), job('b', 3000), job('c', 6000)];
    queue.want(jobs, VIEW, VIEWPORT);
    queue.want(jobs, { scale: 1, x: -5800, y: 0 }, VIEWPORT);
    await finish('a');

    expect(started).toEqual(['a', 'c']);
  });
});

describe('snapQueue results', () => {
  it('keeps a snapshot and does not capture it twice', async () => {
    const { queue, started, finish, changed } = setup();
    queue.want([job('a', 0)], VIEW, VIEWPORT);
    await finish('a', 3100);
    queue.want([job('a', 0)], VIEW, VIEWPORT);

    expect(queue.snaps.get('a')).toEqual({ url: 'png:a', height: 3100, capped: false, target: '/a', width: 100 });
    expect(started).toEqual(['a']);
    expect(changed).toHaveBeenCalled();
  });

  it('recaptures when the frame now shows another page', async () => {
    const { queue, started, finish } = setup();
    queue.want([job('a', 0, '/blog/one')], VIEW, VIEWPORT);
    await finish('a');
    queue.want([job('a', 0, '/blog/two')], VIEW, VIEWPORT);

    expect(started).toEqual(['a', 'a']);
  });

  it('recaptures when the frame was resized', async () => {
    const { queue, started, finish } = setup();
    queue.want([job('a', 0)], VIEW, VIEWPORT);
    await finish('a');
    queue.want([{ ...job('a', 0), device: { w: 600, h: 100 } }], VIEW, VIEWPORT);

    expect(started).toEqual(['a', 'a']);
  });

  it('does not capture a frame while it is left out of the wanted jobs', async () => {
    const { queue, started, finish } = setup();
    queue.want([job('a', 0), job('b', 100)], VIEW, VIEWPORT);
    await finish('a');
    queue.want([job('b', 100)], VIEW, VIEWPORT);
    queue.invalidate(['a']);
    const whileLeftOut = [...started];
    queue.want([job('a', 0), job('b', 100)], VIEW, VIEWPORT);

    expect(whileLeftOut).toEqual(['b', 'a']);
    expect(started).toEqual(['b', 'a', 'a']);
  });

  it('records a failure, keeps it out of the cache and does not retry in a loop', async () => {
    const { queue, started, pending } = setup();
    queue.want([job('a', 0)], VIEW, VIEWPORT);
    pending[0].resolve(null);
    await flush();
    queue.want([job('a', 0)], VIEW, VIEWPORT);

    expect(queue.snaps.has('a')).toBe(false);
    expect(queue.failed.has('a')).toBe(true);
    expect(started).toEqual(['a']);
  });
});

describe('snapQueue store', () => {
  it('starts from the snapshots a previous queue left in the store', () => {
    const store = new Map([['a', { url: 'png:a', height: 900, capped: false, target: '/a', width: 100 }]]);
    const started: string[] = [];
    const queue = snapQueue({ max: 2, store, capture: async (j) => (started.push(j.key), null), changed: () => undefined });

    queue.want([job('a', 0)], VIEW, VIEWPORT);

    expect(started).toEqual([]);
  });
});

describe('snapQueue invalidation', () => {
  it('captures a changed route again', async () => {
    const { queue, started, finish } = setup();
    queue.want([job('a', 0)], VIEW, VIEWPORT);
    await finish('a');

    queue.invalidate(['a']);

    expect(started).toEqual(['a', 'a']);
  });

  it('keeps the old picture on screen until the new one arrives', async () => {
    const { queue, finish } = setup();
    queue.want([job('a', 0)], VIEW, VIEWPORT);
    await finish('a');
    queue.invalidate(['a']);

    expect(queue.snaps.get('a')?.url).toBe('png:a');
  });

  it('throws away a capture that was running when the file changed', async () => {
    const { queue, started, pending } = setup();
    queue.want([job('a', 0)], VIEW, VIEWPORT);
    queue.invalidate(['a']);
    pending[0].resolve({ url: 'stale', height: 1, capped: false });
    await flush();

    expect(queue.snaps.get('a')?.url).not.toBe('stale');
    expect(started).toEqual(['a', 'a']);
  });

  it('retries a failed frame after its file changed', async () => {
    const { queue, started, pending } = setup();
    queue.want([job('a', 0)], VIEW, VIEWPORT);
    pending[0].resolve(null);
    await flush();
    queue.invalidate(['a']);

    expect(started).toEqual(['a', 'a']);
  });
});
