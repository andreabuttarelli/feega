import { describe, expect, it } from 'vitest';
import { laneCount, shootInLanes, type Shooter } from './lanes';

const tick = () => new Promise((r) => setTimeout(r, 0));

function lane(log: string[], name: string, delay: (i: number) => number): Shooter<number> {
  return async (time, index) => {
    log.push(`${name}:${index}`);
    await new Promise((r) => setTimeout(r, delay(index)));
    return time * 10;
  };
}

describe('shootInLanes', () => {
  it('consegna i frame in ordine anche se le corsie finiscono in disordine', async () => {
    const got: [number, number][] = [];
    const times = [0, 1, 2, 3, 4, 5, 6];
    await shootInLanes(times, [lane([], 'a', (i) => (i % 2 ? 1 : 15)), lane([], 'b', () => 1)], async (frame, index) => void got.push([frame, index]), new AbortController().signal);

    expect(got).toEqual(times.map((t, i) => [t * 10, i]));
  });

  it('divide il lavoro fra le corsie', async () => {
    const log: string[] = [];
    await shootInLanes([0, 1, 2, 3], [lane(log, 'a', () => 1), lane(log, 'b', () => 1)], async () => {}, new AbortController().signal);

    expect(log.filter((l) => l.startsWith('a')).length).toBe(2);
    expect(log.filter((l) => l.startsWith('b')).length).toBe(2);
  });

  it('non corre avanti senza limite: in attesa ci sono al più due frame per corsia', async () => {
    let pending = 0;
    let peak = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const shooter: Shooter<number> = async (t) => {
      pending += 1;
      peak = Math.max(peak, pending);
      return t;
    };
    const run = shootInLanes(Array.from({ length: 40 }, (_, i) => i), [shooter, shooter], async (_, index) => {
      if (index === 0) {
        await gate;
      }
      pending -= 1;
    }, new AbortController().signal);
    for (let i = 0; i < 20; i++) {
      await tick();
    }
    expect(peak).toBeLessThanOrEqual(4);
    release();
    await run;
  });

  it('si ferma quando il segnale abortisce', async () => {
    const controller = new AbortController();
    const got: number[] = [];
    const run = shootInLanes([0, 1, 2, 3, 4, 5], [lane([], 'a', () => 1)], async (_, i) => {
      got.push(i);
      if (i === 1) {
        controller.abort();
      }
    }, controller.signal);

    await expect(run).rejects.toThrow();
    expect(got).toEqual([0, 1]);
  });

  it('un errore di una corsia ferma tutto', async () => {
    const broken: Shooter<number> = async () => {
      throw new Error('frame not rendered');
    };
    await expect(shootInLanes([0, 1, 2], [lane([], 'a', () => 1), broken], async () => {}, new AbortController().signal)).rejects.toThrow('frame not rendered');
  });
});

describe('laneCount', () => {
  it.each([
    [{ cores: 8, memoryGb: 8, mobile: false }, 4],
    [{ cores: 2, memoryGb: 8, mobile: false }, 1],
    [{ cores: 8, memoryGb: null, mobile: true }, 2],
    [{ cores: 4, memoryGb: 2, mobile: true }, 1],
    [{ cores: null, memoryGb: null, mobile: false }, 2]
  ])('%o → %i', (info, n) => {
    expect(laneCount(info)).toBe(n);
  });
});
