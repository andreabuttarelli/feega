import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserBusy, sessionSlots } from './browser-slots';

const WAIT_MS = 5_000;

afterEach(() => {
  vi.useRealTimers();
});

describe('sessionSlots', () => {
  it('hands out as many slots as the plan allows without waiting', async () => {
    const slots = sessionSlots({ limit: 2, waitMs: WAIT_MS });

    await slots.take();
    await slots.take();

    expect(slots.busy()).toBe(2);
  });

  it('a third caller gets the slot the moment one is released', async () => {
    const slots = sessionSlots({ limit: 2, waitMs: WAIT_MS });
    const first = await slots.take();
    await slots.take();

    const third = slots.take();
    first();

    await expect(third).resolves.toBeTypeOf('function');
    expect(slots.busy()).toBe(2);
  });

  it('serves the waiting in the order they came', async () => {
    const slots = sessionSlots({ limit: 1, waitMs: WAIT_MS });
    const held = await slots.take();
    const order: string[] = [];
    const a = slots.take().then(() => order.push('a'));
    slots.take().then(() => order.push('b'));

    held();
    await a;

    expect(order).toEqual(['a']);
  });

  it('gives up with BrowserBusy once the short wait is over', async () => {
    vi.useFakeTimers();
    const slots = sessionSlots({ limit: 1, waitMs: WAIT_MS });
    await slots.take();

    const refused = expect(slots.take()).rejects.toBeInstanceOf(BrowserBusy);
    await vi.advanceTimersByTimeAsync(WAIT_MS);

    await refused;
    expect(slots.busy()).toBe(1);
  });

  it('a slot given up on is not handed to the caller who left', async () => {
    vi.useFakeTimers();
    const slots = sessionSlots({ limit: 1, waitMs: WAIT_MS });
    const held = await slots.take();
    const left = slots.take().catch(() => undefined);
    await vi.advanceTimersByTimeAsync(WAIT_MS);
    await left;

    held();

    expect(slots.busy()).toBe(0);
  });

  it('releasing twice frees one slot, not two', async () => {
    const slots = sessionSlots({ limit: 2, waitMs: WAIT_MS });
    const release = await slots.take();
    await slots.take();

    release();
    release();

    expect(slots.busy()).toBe(1);
  });
});
