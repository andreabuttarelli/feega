import { describe, expect, it } from 'vitest';
import { attachedOverPort, hostCore, type Port } from './core-worker';
import { Outcome } from './core-outcome';

type Call = [string, ...unknown[]];

function fakeCore(calls: Call[], pending = false) {
  const text = new TextDecoder();
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, ...args.map((a) => (a instanceof Uint8Array ? text.decode(a) : a))]);
    };
  return {
    set_camera: record('set_camera'),
    put_group: record('put_group'),
    patch_group: (...args: unknown[]) => (record('patch_group')(...args), true),
    drop_group: record('drop_group'),
    patch_uses: record('patch_uses'),
    set_overlay: record('set_overlay'),
    set_selected_overlay: record('set_selected_overlay'),
    set_live_overlay: record('set_live_overlay'),
    set_motion: record('set_motion'),
    set_tiles: record('set_tiles'),
    forget_picture: record('forget_picture'),
    frame: (now: number) => (calls.push(['frame', now]), `${Outcome.Full}\n`),
    cache_pending: () => pending,
    cache_bytes: () => 42,
    picture_bytes: () => 7,
    lost: () => false,
    busy: () => false,
    free: record('free')
  };
}

function wired(core: object) {
  const frames: ((now: number) => void)[] = [];
  const toHost: Port = { post: (message) => host.receive(message), listen: () => {} };
  let toMain: (message: unknown) => void = () => {};
  const mainPort: Port = { post: (message) => toHost.post(message), listen: (on) => (toMain = on) };
  const host = hostCore(core, { post: (message) => toMain(message), frame: (run) => frames.push(run), soon: (run) => frames.push(run) });
  const attached = attachedOverPort(mainPort);
  const tickFrames = (now: number) => frames.splice(0).forEach((run) => run(now));
  return { attached, tickFrames };
}

describe('core in a worker', () => {
  it('applies calls in the order the main thread made them', () => {
    const calls: Call[] = [];
    const { attached, tickFrames } = wired(fakeCore(calls));

    attached.put_group('a', '{"items":[]}');
    attached.patch_uses('{"put":[]}');
    attached.set_camera(1, 2, 3);
    tickFrames(16);

    expect(calls).toEqual([
      ['put_group', 'a', '{"items":[]}'],
      ['patch_uses', '{"put":[]}'],
      ['set_camera', 1, 2, 3],
      ['frame', 16]
    ]);
  });

  it('renders on the worker frame, not on every camera move', () => {
    const calls: Call[] = [];
    const { attached, tickFrames } = wired(fakeCore(calls));

    attached.set_camera(1, 0, 1);
    attached.set_camera(2, 0, 1);
    attached.set_camera(3, 0, 1);
    tickFrames(16);

    expect(calls.filter(([name]) => name === 'frame')).toHaveLength(1);
    expect(calls.filter(([name]) => name === 'set_camera')).toEqual([['set_camera', 3, 0, 1]]);
  });

  it('answers status reads from the last frame the worker reported', () => {
    const calls: Call[] = [];
    const { attached, tickFrames } = wired(fakeCore(calls));

    expect(attached.frame(0)).toBe(Outcome.Idle);
    tickFrames(16);

    expect(attached.frame(32)).toBe(Outcome.Full);
    expect(attached.cache_bytes()).toBe(42);
    expect(attached.picture_bytes()).toBe(7);
  });

  it('keeps rendering while the core still has cache work pending', () => {
    const calls: Call[] = [];
    const { attached, tickFrames } = wired(fakeCore(calls, true));

    attached.frame(0);
    tickFrames(16);
    tickFrames(32);

    expect(calls.filter(([name]) => name === 'frame')).toHaveLength(2);
  });

  it('refuses to patch a group the worker was never given', () => {
    const calls: Call[] = [];
    const { attached } = wired(fakeCore(calls));

    expect(attached.patch_group('missing', 'b', '{}')).toBe(false);
    attached.put_group('a', '{}');
    expect(attached.patch_group('a', 'b', '{}')).toBe(true);
  });

  it('never lets the scene reference a picture whose bitmap has not arrived', async () => {
    const calls: Call[] = [];
    const arrivals: (() => void)[] = [];
    const bitmapOf = (name: string) => ({ name, close: () => {} });
    globalThis.createImageBitmap = ((source: { name: string }) => new Promise((resolve) => arrivals.push(() => resolve(bitmapOf(source.name))))) as unknown as typeof createImageBitmap;
    const { attached, tickFrames } = wired({ ...fakeCore(calls), picture: (clip: string) => calls.push(['picture', clip]) });

    attached.picture('a', { name: 'a' }, 1, 1);
    attached.picture('b', { name: 'b' }, 1, 1);
    attached.put_group('g', '{"items":[]}');
    attached.patch_uses('{"put":["g"]}');
    attached.set_camera(5, 0, 1);
    tickFrames(16);
    expect(calls.map(([name]) => name)).toEqual(['set_camera', 'frame']);

    arrivals[1]();
    await Promise.resolve();
    await Promise.resolve();
    expect(calls.map(([name]) => name)).toEqual(['set_camera', 'frame']);

    arrivals[0]();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls.slice(2).map((c) => c.slice(0, 2))).toEqual([
      ['picture', 'a'],
      ['picture', 'b'],
      ['put_group', 'g'],
      ['patch_uses', '{"put":["g"]}']
    ]);
  });

  it('answers a poster with the bytes the worker rendered', async () => {
    const calls: Call[] = [];
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const { attached } = wired({ ...fakeCore(calls), poster: async () => bytes });

    await expect(attached.poster!('a', 1, 1, 1)).resolves.toEqual(bytes);
  });
});
