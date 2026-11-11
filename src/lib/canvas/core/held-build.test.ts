import { describe, expect, it, vi } from 'vitest';
import { heldBuilds } from './held-build';

const PLAY_TICKS = 30;

describe('heldBuilds', () => {
  it('prepares a playing frame once, however many ticks ask for it', async () => {
    const make = vi.fn(async (doc: object) => ({ doc }));
    const held = heldBuilds(make, () => {});
    const doc = {};

    for (let tick = 0; tick < PLAY_TICKS; tick++) {
      await held.of('f', [doc], doc);
    }

    expect(make).toHaveBeenCalledTimes(1);
  });

  it('prepares again and releases the old one when the doc changes', async () => {
    const release = vi.fn();
    const held = heldBuilds(async (doc: object) => ({ doc }), release);
    const first = {};
    const second = {};

    const old = await held.of('f', [first], first);
    await held.of('f', [second], second);
    await Promise.resolve();

    expect(release).toHaveBeenCalledWith(old);
  });

  it('keeps frames apart', async () => {
    const make = vi.fn(async (doc: object) => ({ doc }));
    const held = heldBuilds(make, () => {});
    const doc = {};

    await held.of('a', [doc], doc);
    await held.of('b', [doc], doc);

    expect(make).toHaveBeenCalledTimes(2);
  });

  it('prepares again after a failed preparation', async () => {
    const make = vi.fn(async () => {
      throw new Error('boom');
    });
    const held = heldBuilds(make, () => {});
    const doc = {};

    await expect(held.of('f', [doc], doc)).rejects.toThrow();
    await expect(held.of('f', [doc], doc)).rejects.toThrow();

    expect(make).toHaveBeenCalledTimes(2);
  });

  it('releases a frame that stops playing', async () => {
    const release = vi.fn();
    const held = heldBuilds(async (doc: object) => ({ doc }), release);
    const doc = {};

    const made = await held.of('f', [doc], doc);
    held.drop('f');
    await Promise.resolve();

    expect(release).toHaveBeenCalledWith(made);
  });
});
