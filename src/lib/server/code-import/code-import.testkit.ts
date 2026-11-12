import { vi } from 'vitest';
import type { AppTab } from '$lib/server/web/browser';
import type { FrameStore } from '$lib/server/motion/move-element';
import type { PageTree } from '$lib/server/url-import/page-tree';
import type { importCodeAt } from './import-code';
import type { RepoRunner } from './sandbox-runner';

export const APP = 'https://sb-1.vercel.run';
export const button = (id: string, use: number, x: number, label: string) => ({
  id,
  type: 'FRAME',
  use,
  absoluteBoundingBox: { x, y: 10, width: 80, height: 30 },
  fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 } }],
  children: [{ id: `${id}t`, type: 'TEXT', characters: label, absoluteBoundingBox: { x: x + 10, y: 17, width: 50, height: 16 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], style: { fontFamily: 'Inter', fontSize: 14, fontWeight: 500 } }]
});

export const TREE: PageTree = {
  title: 'Dashboard',
  url: `${APP}/`,
  width: 400,
  height: 200,
  truncated: false,
  root: { id: '1', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], children: [{ ...button('2', 0, 10, 'Save'), source: { at: 'src/a.tsx:3:1', tag: 'button', cls: '' } },  button('3', 1, 100, 'Cancel'), button('4', 2, 200, 'Delete')] }
};

export const USES = [
  { component: 'Button', props: { children: 'Save' } },
  { component: 'Button', props: { children: 'Cancel' } },
  { component: 'Button', props: { variant: 'destructive', children: 'Delete' } }
];

export function tabOf() {
  return {
    goto: vi.fn(async () => 200),
    waitFor: vi.fn(async () => {
      throw new Error('no password field');
    }),
    url: () => `${APP}/`,
    scroll: vi.fn(async () => undefined),
    reveal: vi.fn(async () => ({ height: 900, hidden: 0 })),
    settle: vi.fn(async () => undefined),
    scheme: vi.fn(async () => undefined),
    viewport: vi.fn(async () => undefined),
    seeAll: vi.fn(async () => undefined),
    sample: vi.fn(async () => 0),
    overlay: vi.fn(async () => null),
    click: vi.fn(async () => undefined),
    press: vi.fn(async () => undefined),
    marks: vi.fn(async () => USES),
    tree: vi.fn(async (): Promise<PageTree> => TREE),
    restore: vi.fn(async () => undefined),
    close: vi.fn(async () => 0.002)
  } as unknown as AppTab & { tree: ReturnType<typeof vi.fn>; marks: ReturnType<typeof vi.fn>; goto: ReturnType<typeof vi.fn>; scheme: ReturnType<typeof vi.fn>; viewport: ReturnType<typeof vi.fn> };
}

export function storeOf() {
  const docs = new Map<string, { doc: unknown; version: number }>();
  const store = {
    create: vi.fn(async (_at: unknown, doc: unknown) => {
      docs.set('frame-1', { doc, version: 1 });
      return 'frame-1';
    }),
    read: vi.fn(async (id: string) => docs.get(id) ?? null),
    write: vi.fn(async (id: string, version: number, doc: unknown) => {
      docs.set(id, { doc, version: version + 1 });
      return true;
    })
  } as unknown as FrameStore;
  return { store, docs };
}

export function askOf(over: Partial<Parameters<typeof importCodeAt>[0]> = {}) {
  const tab = tabOf();
  const stop = vi.fn(async () => undefined);
  const runner = vi.fn(async () => ({ ok: true as const, app: { url: APP, key: 'k3y', names: ['Button'], sha: null, stop } }));
  const { store, docs } = storeOf();
  let n = 0;
  return {
    tab,
    stop,
    runner,
    docs,
    ask: { repo: 'https://github.com/acme/app', routes: ['/settings'], at: { x: 0, y: 0 }, store, place: { projectId: 'p', canvasId: 'c' }, open: async () => tab, runner: runner as RepoRunner, guard: async () => undefined, importImage: async () => null, newId: () => `n${++n}`, settleMs: 0, ...over }
  };
}
