import { describe, expect, it } from 'vitest';
import { until, type Probes, type Watched } from './ready';

const PLANNED = 5173;
const FALLBACK = 5174;

const alive = { exitCode: null } as { exitCode: number | null };

function probes(listeningOn: number[], ours: number[]): Probes {
  let tick = 0;
  return {
    listening: async (port) => listeningOn.includes(port),
    ours: async (port) => ours.includes(port),
    wait: () => Promise.resolve(),
    now: () => (tick += 1),
    timeoutMs: 50
  };
}

describe('the url the preview opens', () => {
  it('is the one the dev server prints when a stranger holds the planned port', async () => {
    const seen: Watched = { url: `http://localhost:${FALLBACK}/`, failed: null };
    const ready = await until(PLANNED, alive, seen, probes([PLANNED, FALLBACK], [FALLBACK]));
    expect(ready).toBe(`http://localhost:${FALLBACK}/`);
  });

  it('is never a stranger on the planned port while the dev server prints nothing yet', async () => {
    const seen: Watched = { url: null, failed: null };
    const ready = await until(PLANNED, alive, seen, probes([PLANNED], []));
    expect(ready).toBeNull();
  });

  it('is the planned port when our own server listens there and prints nothing', async () => {
    const seen: Watched = { url: null, failed: null };
    const ready = await until(PLANNED, alive, seen, probes([PLANNED], [PLANNED]));
    expect(ready).toBe(`http://127.0.0.1:${PLANNED}/`);
  });
});
