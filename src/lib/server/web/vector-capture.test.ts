import { describe, expect, it, vi } from 'vitest';
import type { AppTab } from './browser';
import { vectorCapture } from './vector-capture';

const PAGE = { url: 'https://feega.test/', title: 'feega', width: 1280, height: 800, background: 'rgb(0, 0, 0)', nodes: [{ kind: 'text', hint: 'none', x: 10, y: 10, w: 80, h: 20, text: 'make your brand move', size: 16 }] };

const tab = (goto: AppTab['goto']) => ({ goto, vector: vi.fn(async () => PAGE), close: vi.fn(async () => 0) }) as unknown as AppTab;

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
