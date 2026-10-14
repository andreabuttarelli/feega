import { describe, expect, it, vi } from 'vitest';
import { Script, scriptUrl } from '../libs/catalog';
import { playerWarmer, whenIdle } from './warm-player';

const ORIGIN = 'https://feega.app';

function ports() {
  return { fetch: vi.fn(async () => new Response('runtime')), load: vi.fn(async () => undefined) };
}

describe('warming the player before the editor needs it', () => {
  it('loads the player element and fetches the runtime its frame will ask for, without credentials', async () => {
    const p = ports();

    await playerWarmer(p)(ORIGIN);

    expect(p.load).toHaveBeenCalledOnce();
    expect(p.fetch).toHaveBeenCalledWith(scriptUrl(ORIGIN, Script.Runtime), { mode: 'cors', credentials: 'omit' });
  });

  it('warms once per page however many frames are opened', async () => {
    const p = ports();
    const warm = playerWarmer(p);

    await Promise.all([warm(ORIGIN), warm(ORIGIN)]);
    await warm(ORIGIN);

    expect(p.fetch).toHaveBeenCalledOnce();
    expect(p.load).toHaveBeenCalledOnce();
  });

  it('a failed warm-up is not an error: the frame fetches the runtime itself', async () => {
    const warm = playerWarmer({ fetch: vi.fn(async () => Promise.reject(new Error('offline'))), load: vi.fn(async () => undefined) });

    await expect(warm(ORIGIN)).resolves.toBeUndefined();
  });
});

describe('waiting for an idle moment', () => {
  it('uses the idle callback where the browser has one', () => {
    const idle = vi.fn();
    const job = () => undefined;

    whenIdle(job, { requestIdleCallback: idle, setTimeout: vi.fn() });

    expect(idle).toHaveBeenCalledWith(job);
  });

  it('falls back to a timer on Safari, which has no idle callback', () => {
    const timer = vi.fn();
    const job = () => undefined;

    whenIdle(job, { setTimeout: timer });

    expect(timer).toHaveBeenCalledWith(job, expect.any(Number));
  });
});
