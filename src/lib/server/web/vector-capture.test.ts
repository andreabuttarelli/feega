import { describe, expect, it, vi } from 'vitest';
import type { AppTab } from './browser';
import { CaptureSession, vectorCapture } from './vector-capture';

const PAGE = { url: 'https://feega.test/', title: 'feega', width: 1280, height: 800, background: 'rgb(0, 0, 0)', nodes: [{ kind: 'text', hint: 'none', x: 10, y: 10, w: 80, h: 20, text: 'make your brand move', size: 16 }] };

const tab = (goto: AppTab['goto'], at = 'https://feega.test/') => ({ goto, url: () => at, restore: vi.fn(async () => undefined), vector: vi.fn(async () => PAGE), close: vi.fn(async () => 0), overlay: vi.fn(async () => null), click: vi.fn(async () => undefined), press: vi.fn(async () => undefined) }) as unknown as AppTab;

const SESSION = { cookies: [{ name: 'sb', value: 'tok', domain: 'feega.test', path: '/', expires: -1, httpOnly: true, secure: true }], storage: {} };

describe('reading a live page as vector UI', () => {
  it('reads what is painted when a site never goes network-idle (feega.app timed out at 20 s in the v3 trailer run)', async () => {
    const capture = vectorCapture(async () => tab(async () => Promise.reject(new Error('Navigation timeout of 20000 ms exceeded'))), 0);

    const read = await capture('https://feega.test/');

    expect(read.ok && read.ui.nodes.map((n) => n.text)).toEqual(['make your brand move']);
  });

  it('refuses a page that answers with an error status', async () => {
    const capture = vectorCapture(async () => tab(async () => 404), 0);

    expect(await capture('https://feega.test/')).toMatchObject({ ok: false });
  });
});

describe('reading a logged-in app screen', () => {
  it('skips a welcome tour before reading the screen, so the UI rebuilt is the app and not the tour (v4)', async () => {
    const page = tab(async () => 200, 'https://feega.test/app');
    let tour = true;
    vi.mocked(page.overlay).mockImplementation(async () => (tour ? { buttons: ['Skip'] } : null));
    vi.mocked(page.click).mockImplementation(async () => {
      tour = false;
    });
    vi.mocked(page.vector).mockImplementation(async () => (tour ? { ...PAGE, nodes: [] } : PAGE));

    const read = await vectorCapture(async () => page, 0)('https://feega.test/app');

    expect(read.ok && read.ui.nodes).toHaveLength(1);
    expect(read.ok && read.session).toBe(CaptureSession.None);
  });

  it('opens the page with the session app_browse saved, so recreate_ui rebuilds the app, not the marketing site (v3)', async () => {
    const page = tab(async () => 200, 'https://feega.test/p/1/c/2');
    const capture = vectorCapture(async () => page, 0, async (url) => (url.startsWith('https://feega.test') ? { session: SESSION, origin: 'https://feega.test' } : null));

    const read = await capture('https://feega.test/p/1/c/2');

    expect(read.ok).toBe(true);
    expect(page.restore).toHaveBeenCalledWith(SESSION, 'https://feega.test');
    expect(read.ok && read.session).toBe(CaptureSession.Kept);
  });

  it('says to sign in with app_browse when the page bounces to the login', async () => {
    const capture = vectorCapture(async () => tab(async () => 200, 'https://feega.test/login'), 0, async () => null);

    const read = await capture('https://feega.test/app');

    expect(read.ok ? '' : read.error).toMatch(/app_browse/);
  });
});
