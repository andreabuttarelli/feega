import { describe, expect, it, vi } from 'vitest';
import { AssetKind } from '$lib/motion/components';
import { FarmTask, TaskState } from './farm-render';
import { captureSite, type CapturePorts } from './site-capture';

function ports(overrides: Partial<CapturePorts> = {}): CapturePorts & { stored: string[]; logged: number[] } {
  const stored: string[] = [];
  const logged: number[] = [];
  return {
    stored,
    logged,
    launch: vi.fn(async () => 'w1'),
    wait: vi.fn(async () => ({ state: TaskState.Done, error: null })),
    read: vi.fn(async () => [
      { name: 'scroll-000.jpg', bytes: Buffer.from('a') },
      { name: 'scroll-020.jpg', bytes: Buffer.from('b') }
    ]),
    stop: vi.fn(async () => {}),
    cost: vi.fn(async () => 0.02),
    log: (usd) => logged.push(usd),
    store: async (bytes, label) => {
      stored.push(label);
      return { ok: true, width: 1920, height: 1080, asset: { id: `a${stored.length}`, kind: AssetKind.Image, label, previewUrl: '', url: null } };
    },
    ...overrides
  };
}

describe('capturing a site for a video', () => {
  it('stores every screenshot as a picture and bills the browser time', async () => {
    const p = ports();

    const out = await captureSite(p, 'https://dub.co');

    expect(out.ok && out.shots.map((s) => s.asset.id)).toEqual(['a1', 'a2']);
    expect(p.stored).toEqual(['dub.co · top of the page', 'dub.co · 20% down the page']);
    expect(p.wait).toHaveBeenCalledWith('w1', FarmTask.Capture);
    expect(p.logged).toEqual([0.02]);
    expect(p.stop).toHaveBeenCalledWith('w1');
  });

  it('stops the worker and reports the farm error when the capture fails', async () => {
    const p = ports({ wait: vi.fn(async () => ({ state: TaskState.Failed, error: 'capture failed: timeout' })) });

    const out = await captureSite(p, 'https://dub.co');

    expect(out).toEqual({ ok: false, error: 'capture failed: timeout' });
    expect(p.stop).toHaveBeenCalledWith('w1');
    expect(p.logged).toEqual([0.02]);
  });

  it('reports a page that gave no screenshots', async () => {
    const p = ports({ read: vi.fn(async () => []) });

    expect((await captureSite(p, 'https://dub.co')).ok).toBe(false);
  });

  it('turns a launch refusal into an error, not a crash', async () => {
    const p = ports({ launch: vi.fn(async () => Promise.reject(new Error('only a public https page can be captured'))) });

    expect(await captureSite(p, 'http://dub.co')).toEqual({ ok: false, error: 'only a public https page can be captured' });
  });
});
