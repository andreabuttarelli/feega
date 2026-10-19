import { describe, expect, it, vi } from 'vitest';
import { LoadKind, loadClaims, loadTiming, type LoadReport } from './load-timing';

function frames(gaps: number[]) {
  let now = 0;
  const queue: ((t: number) => void)[] = [];
  return {
    now: () => now,
    raf: (cb: (t: number) => void) => queue.push(cb),
    run() {
      for (const gap of gaps) {
        now += gap;
        queue.splice(0).forEach((cb) => cb(now));
      }
    }
  };
}

const base = { kind: LoadKind.Navigation, renderer: 'webgpu', device: 'phone', engine: 'webkit', nodes: 82 };

describe('canvas load timing', () => {
  it('reports revealed, settled and interactive once the frames stay calm for half a second', () => {
    const f = frames([16, 200, 16, ...Array(40).fill(16)]);
    const report = vi.fn<(r: LoadReport) => void>();
    const timing = loadTiming({ ...base, now: f.now, raf: f.raf, report });

    timing.revealed(3, 1500);
    timing.settled();
    f.run();

    expect(report).toHaveBeenCalledTimes(1);
    const sent = report.mock.calls[0][0];
    expect(sent).toMatchObject({ kind: LoadKind.Navigation, renderer: 'webgpu', device: 'phone', engine: 'webkit', nodes: 82, revealed_ms: 0, settled_ms: 0, missing_at_reveal: 3, reveal_wait_ms: 1500 });
    expect(sent.interactive_ms).toBe(216);
  });

  it('sends nothing before the canvas settles', () => {
    const f = frames(Array(60).fill(16));
    const report = vi.fn();
    const timing = loadTiming({ ...base, now: f.now, raf: f.raf, report });

    timing.revealed(0, 0);
    f.run();

    expect(report).not.toHaveBeenCalled();
  });
});

describe('which load a canvas mount is', () => {
  it('is the navigation only for the first canvas the document opened on', () => {
    const claim = loadClaims();

    expect(claim('/p/a/c/b', '/p/a/c/b')).toBe(LoadKind.Navigation);
    expect(claim('/p/a/c/b', '/p/a/c/b')).toBe(LoadKind.InApp);
  });

  it('is in-app when the document opened on another page', () => {
    expect(loadClaims()('/projects', '/p/a/c/b')).toBe(LoadKind.InApp);
  });
});
