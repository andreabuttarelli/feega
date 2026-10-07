import { describe, expect, it, vi } from 'vitest';
import { AssetKind } from '$lib/motion/components';
import type { FarmWorker, RenderFarm } from './render-farm';
import { CaptureView } from './motion-tools';
import { CAPTURE_SCALE, VIEWPORTS, captureProgram, farmCapture } from './site-capture';

function fakeFarm(run: FarmWorker['run'], files: Record<string, string>) {
  const worker: FarmWorker = { name: 'w', write: vi.fn(async () => {}), run, spawn: vi.fn(), read: vi.fn(async (path: string) => (path in files ? Buffer.from(files[path]) : null)), stop: vi.fn(async () => {}) };
  const farm: RenderFarm = { open: vi.fn(async () => worker), attach: vi.fn(), running: vi.fn(), usage: vi.fn() };
  return { farm, worker };
}

const stored = vi.fn(async (shot: { part: string }, page: { label: string }) => ({ part: shot.part, asset: { id: shot.part, kind: AssetKind.Image, label: page.label, previewUrl: '', url: null }, width: 780, height: 1688 }));

describe('capturing a site on the render farm', () => {
  it('photographs the page at 2x in the asked viewport and stores the top and each section', async () => {
    const manifest = JSON.stringify([{ part: 'top', file: '/a.png' }, { part: 'section 2', file: '/b.png' }]);
    const { farm, worker } = fakeFarm(vi.fn(async () => ({ exitCode: 0, output: '' })), { '/vercel/sandbox/job/capture/manifest.json': manifest, '/a.png': 'A', '/b.png': 'B' });

    const out = await farmCapture(farm, stored)('https://dub.co', CaptureView.Mobile);

    expect(out).toMatchObject({ ok: true, shots: [{ part: 'top' }, { part: 'section 2' }] });
    expect(stored).toHaveBeenCalledWith({ part: 'top', bytes: Buffer.from('A') }, { url: 'https://dub.co', label: 'mobile top · dub.co' });
    expect(worker.stop).toHaveBeenCalled();
  });

  it('a page that fails to load comes back as an error and the sandbox still stops', async () => {
    const { farm, worker } = fakeFarm(vi.fn(async () => ({ exitCode: 1, output: 'TimeoutError: Navigation timeout' })), {});

    const out = await farmCapture(farm, stored)('https://slow.example', CaptureView.Desktop);

    expect(out).toEqual({ ok: false, error: expect.stringContaining('Navigation timeout') });
    expect(worker.stop).toHaveBeenCalled();
  });

  it('refuses anything that is not a public https page before opening a sandbox', async () => {
    const { farm } = fakeFarm(vi.fn(), {});

    expect(await farmCapture(farm, stored)('file:///etc/passwd', CaptureView.Desktop)).toMatchObject({ ok: false });
    expect(farm.open).not.toHaveBeenCalled();
  });

  it('the program asks the browser for the viewport at device scale 2', () => {
    const program = captureProgram('https://dub.co', CaptureView.Desktop);

    expect(program).toContain(JSON.stringify(VIEWPORTS[CaptureView.Desktop]));
    expect(program).toContain(`, ${CAPTURE_SCALE}, `);
  });
});
