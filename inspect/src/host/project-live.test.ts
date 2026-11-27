import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ToView, type ViewMessage } from '../messages';
import { listComponents } from './component-list';
import { projectLive } from './project-live';
import { listRoutes } from './project-routes';

const DEBOUNCE_MS = 60;
const SETTLE_MS = 700;
const FIXTURE_SETTLE_MS = 400;
const ARM_MS = 300;

const closers: (() => void)[] = [];

afterEach(() => closers.splice(0).forEach((close) => close()));

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const write = (root: string, path: string, text = '<div />') => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

async function live(files: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'feega-project-live-'));
  files.forEach((file) => write(root, file));
  await pause(FIXTURE_SETTLE_MS);
  const posted: ViewMessage[] = [];
  const index = projectLive({ appRoot: () => root, routes: () => listRoutes(root), components: () => listComponents(root, async () => 0), post: (m) => posted.push(m), debounceMs: DEBOUNCE_MS });
  closers.push(index.dispose);
  index.routesSent(await listRoutes(root));
  index.componentsSent(await listComponents(root, async () => 0));
  index.watch();
  await pause(ARM_MS);
  return { root, posted, index };
}

const routesOf = (posted: ViewMessage[]) => posted.flatMap((m) => (m.kind === ToView.Routes ? [m.routes.map((r) => r.route)] : []));

const componentsOf = (posted: ViewMessage[]) => posted.flatMap((m) => (m.kind === ToView.Components ? [m.components.map((c) => c.name)] : []));

const changedOf = (posted: ViewMessage[]) => posted.flatMap((m) => (m.kind === ToView.FilesChanged ? m.files : []));

describe('projectLive', () => {
  it('pushes the routes when a page is created, without being asked', async () => {
    const { root, posted } = await live(['src/routes/+page.svelte']);

    write(root, 'src/routes/pricing/+page.svelte');
    await pause(SETTLE_MS);

    expect(routesOf(posted).at(-1)).toEqual(['/', '/pricing']);
  });

  it('pushes the routes when a page is deleted', async () => {
    const { root, posted } = await live(['src/routes/+page.svelte', 'src/routes/about/+page.svelte']);

    rmSync(join(root, 'src/routes/about'), { recursive: true });
    await pause(SETTLE_MS);

    expect(routesOf(posted).at(-1)).toEqual(['/']);
  });

  it('pushes the components when one is created, deleted or renamed', async () => {
    const { root, posted } = await live(['src/lib/Card.svelte']);

    write(root, 'src/lib/Badge.svelte');
    await pause(SETTLE_MS);
    expect(componentsOf(posted).at(-1)).toEqual(['Badge', 'Card']);

    renameSync(join(root, 'src/lib/Card.svelte'), join(root, 'src/lib/Tile.svelte'));
    await pause(SETTLE_MS);
    expect(componentsOf(posted).at(-1)).toEqual(['Badge', 'Tile']);

    rmSync(join(root, 'src/lib/Badge.svelte'));
    await pause(SETTLE_MS);
    expect(componentsOf(posted).at(-1)).toEqual(['Tile']);
  });

  it('does not push a list that did not change', async () => {
    const { root, posted } = await live(['src/lib/Card.svelte']);

    write(root, 'src/lib/helper.ts', 'export const a = 1;');
    await pause(SETTLE_MS);

    expect(posted.filter((m) => m.kind !== ToView.FilesChanged)).toEqual([]);
  });

  it('names the files whose content changed, so the canvases can refresh them', async () => {
    const { root, posted } = await live(['src/lib/Card.svelte']);

    write(root, 'src/lib/Card.svelte', '<div>edited</div>');
    await pause(SETTLE_MS);

    expect(changedOf(posted)).toEqual(['src/lib/Card.svelte']);
    expect(posted.filter((m) => m.kind !== ToView.FilesChanged)).toEqual([]);
  });

  it('watches nothing until the view has asked for a list, and nothing after dispose', async () => {
    const root = mkdtempSync(join(tmpdir(), 'feega-project-live-'));
    const posted: ViewMessage[] = [];
    const index = projectLive({ appRoot: () => root, routes: async () => [], components: async () => [], post: (m) => posted.push(m), debounceMs: DEBOUNCE_MS });
    closers.push(index.dispose);

    write(root, 'src/lib/Early.svelte');
    await pause(SETTLE_MS);
    index.dispose();
    write(root, 'src/lib/Late.svelte');
    await pause(SETTLE_MS);

    expect(posted).toEqual([]);
  });
});
