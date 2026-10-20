import { describe, expect, it } from 'vitest';
import { readPool } from './read-pool';

const later = (ms: number) => new Promise((r) => setTimeout(r, ms));
const never = () => new Promise<never>(() => {});

describe('custom component reads', () => {
  it('run two at a time', async () => {
    const run = readPool({ lanes: 2, timeoutMs: 1000 });
    let busy = 0;
    let most = 0;
    const read = async () => {
      busy++;
      most = Math.max(most, busy);
      await later(5);
      busy--;
    };
    await Promise.all([1, 2, 3, 4].map(() => run(() => 0, read)));
    expect(most).toBe(2);
  });

  it('a waiting read nearest the viewport goes next', async () => {
    const run = readPool({ lanes: 1, timeoutMs: 1000 });
    const order: string[] = [];
    const read = (name: string) => async () => {
      order.push(name);
      await later(1);
    };
    await Promise.all([run(() => 0, read('first')), run(() => 500, read('far')), run(() => 10, read('near'))]);
    expect(order).toEqual(['first', 'near', 'far']);
  });

  it('a hung probe times out and frees its lane for the next read', async () => {
    const run = readPool({ lanes: 1, timeoutMs: 20 });
    const hung = run(() => 0, never);
    const next = run(() => 0, async () => 'drawn');
    await expect(hung).rejects.toThrow('timed out');
    expect(await next).toBe('drawn');
  });
});
