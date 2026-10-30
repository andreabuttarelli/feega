import { describe, expect, it, vi } from 'vitest';
import type { AppTab } from '$lib/server/web/browser';
import type { FrameStore } from '$lib/server/motion/move-element';
import type { PageTree } from '$lib/server/url-import/page-tree';
import { CodeImportOutcome } from './import-code';
import { importStorybookAt } from './import-storybook';

const BASE = 'https://sb.example.com/';
const INDEX = { v: 5, entries: { 'button--primary': { id: 'button--primary', title: 'Components/Button', name: 'Primary', type: 'story' }, 'button--ghost': { id: 'button--ghost', title: 'Components/Button', name: 'Ghost', type: 'story' } } };

const story = (x: number): PageTree => ({
  title: 'story',
  url: BASE,
  width: 1280,
  height: 800,
  truncated: false,
  root: { id: '1', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 1280, height: 800 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], children: [{ id: '2', type: 'FRAME', use: 0, absoluteBoundingBox: { x, y: 20, width: 90, height: 36 }, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 } }] }] }
});

function askOf(over: Record<string, unknown> = {}) {
  const tab = {
    goto: vi.fn(async () => 200),
    url: () => BASE,
    scroll: vi.fn(async () => undefined),
    reveal: vi.fn(async () => ({ height: 800, hidden: 0 })),
    settle: vi.fn(async () => undefined),
    seeAll: vi.fn(async () => undefined),
    overlay: vi.fn(async () => null),
    click: vi.fn(async () => undefined),
    press: vi.fn(async () => undefined),
    marks: vi.fn(async () => [{ component: 'Button', props: { variant: 'primary' } }]),
    tree: vi.fn(async () => story(20)),
    close: vi.fn(async () => 0)
  } as unknown as AppTab & { marks: ReturnType<typeof vi.fn>; goto: ReturnType<typeof vi.fn> };
  let saved: unknown = null;
  const store = { create: vi.fn(async (_a: unknown, doc: unknown) => ((saved = doc), 'frame-1')), read: vi.fn(async () => (saved ? { doc: saved, version: 1 } : null)), write: vi.fn(async () => true) } as unknown as FrameStore;
  const fetchFn = vi.fn(async (url: string) => (url === `${BASE}index.json` ? new Response(JSON.stringify(INDEX)) : new Response('', { status: 404 })));
  let n = 0;
  return { tab, fetchFn, ask: { storybook: BASE, at: { x: 0, y: 0 }, store, place: { projectId: 'p', canvasId: 'c' }, open: async () => tab, guard: async () => undefined, importImage: async () => null, newId: () => `n${++n}`, settleMs: 0, fetchFn: fetchFn as unknown as typeof fetch, ...over } };
}

describe('importStorybookAt', () => {
  it('apre ogni storia, con i nomi dei componenti dell\'indice, in un frame solo', async () => {
    const { ask, tab } = askOf();

    const done = await importStorybookAt(ask);

    expect(tab.goto).toHaveBeenCalledWith(`${BASE}iframe.html?id=button--primary&viewMode=story`);
    expect(tab.goto).toHaveBeenCalledWith(`${BASE}iframe.html?id=button--ghost&viewMode=story`);
    expect(tab.marks).toHaveBeenCalledWith(['Button']);
    expect(done).toMatchObject({ outcome: CodeImportOutcome.Ok, pages: ['Button / Primary', 'Button / Ghost'], components: 1, variants: 1, instances: 1 });
  });

  it('un link che non è una Storybook non apre il browser', async () => {
    const { ask, tab } = askOf({ fetchFn: vi.fn(async () => new Response('', { status: 404 })) });

    expect((await importStorybookAt(ask)).outcome).toBe(CodeImportOutcome.Unreadable);
    expect(tab.goto).not.toHaveBeenCalled();
  });

  it('un host privato è rifiutato prima di leggere l\'indice', async () => {
    const { ask, fetchFn } = askOf({ guard: async () => Promise.reject(new Error('private')) });

    expect((await importStorybookAt(ask)).outcome).toBe(CodeImportOutcome.Failed);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
