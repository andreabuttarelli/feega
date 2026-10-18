import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated, type E2eSession } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const PAN_MS = 3000;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, lastRenderAssetId: null };
const sheet = (shape: string) => ({
  version: 5,
  fps: 30,
  width: 200,
  height: 200,
  durationInFrames: 150,
  background: 'transparent',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: `c${shape}`, from: 0, durationInFrames: 150, component: 'Shape', props: { shape, x: 0.5, y: 0.5, width: 1, height: 1 } }] }],
  comps: {},
  assets: []
});

type Probe = { remounts: number; requests: string[]; counts: Record<string, number>; blankFrames: number };

async function poster(admin: SupabaseClient, s: E2eSession): Promise<string> {
  const body = await sharp({ create: { width: 640, height: 360, channels: 3, background: '#000' } }).jpeg().toBuffer();
  const path = `${s.orgId}/${s.projectId}/${randomUUID()}.jpg`;
  expect((await admin.storage.from('canvas-assets').upload(path, body, { contentType: 'image/jpeg' })).error).toBeNull();
  const asset = await admin.from('assets').insert({ org_id: s.orgId, project_id: s.projectId, type: 'image', source: 'upload', url: path, mime_type: 'image/jpeg' }).select('id').single();
  return asset.data!.id as string;
}

async function frame(admin: SupabaseClient, s: E2eSession, seedNode: (n: { type: string; x: number; y: number; data: Record<string, unknown> }) => Promise<{ id: string }>, x: number, data: Record<string, unknown>, body: unknown) {
  const node = await seedNode({ type: 'motion', x, y: 80, data: { ...LANDSCAPE, ...data } });
  expect((await admin.from('motion_revisions').insert({ org_id: s.orgId, node_id: node.id, version: 1, doc: body, actor_kind: 'user', actor_id: s.userId })).error).toBeNull();
  return node;
}

async function watch(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __steady: { remounts: number; blank: number } };
    w.__steady = { remounts: 0, blank: 0 };
    new MutationObserver((records) => {
      for (const r of records) {
        for (const n of [...r.addedNodes, ...r.removedNodes]) {
          if (n instanceof HTMLElement && (n.matches('.gpu-dom-node, [data-motion-node], iframe, hyperframes-player') || n.querySelector?.('[data-motion-node], iframe'))) {
            w.__steady.remounts += 1;
          }
        }
      }
    }).observe(document.querySelector('[data-canvas-surface]')!, { subtree: true, childList: true });
  });
}

async function probe(page: Page, run: () => Promise<void>): Promise<Probe> {
  const requests: string[] = [];
  const onRequest = (r: { url: () => string }) => requests.push(r.url());
  const before = await page.evaluate(() => ({ ...((window as unknown as { __gpuCanvas?: { counts?: Record<string, number> } }).__gpuCanvas?.counts ?? {}) }));
  await watch(page);
  page.on('request', onRequest);
  await run();
  page.off('request', onRequest);
  const after = await page.evaluate(() => ({ ...((window as unknown as { __gpuCanvas?: { counts?: Record<string, number> } }).__gpuCanvas?.counts ?? {}) }));
  const remounts = await page.evaluate(() => (window as unknown as { __steady: { remounts: number } }).__steady.remounts);
  const counts = Object.fromEntries(Object.keys(after).map((k) => [k, (after[k] ?? 0) - (before[k] ?? 0)]).filter(([, v]) => v));
  return { remounts, requests: requests.filter((u) => !/posthog|fonts\.g|supabase\.co\/realtime|__data|_app\/immutable|@vite|node_modules/.test(u)), counts, blankFrames: 0 };
}

async function pan(page: Page, ms: number) {
  const pane = (await page.locator('[data-canvas-surface]').boundingBox())!;
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height * 0.75);
  const until = Date.now() + ms;
  for (let i = 0; Date.now() < until; i++) {
    await page.mouse.wheel(Math.sin(i / 6) * 30, Math.cos(i / 9) * 20);
  }
}

test.describe('the GPU canvas holds still while the camera moves @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(150_000);

  test('panning 3 s over frames that stay in view rebuilds, fetches, captures and remounts nothing', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const asset = await poster(admin, session);
    await frame(admin, session, seedNode, 0, { posterAssetId: asset, posterRevision: 1 }, doc);
    await frame(admin, session, seedNode, 520, { posterAssetId: null }, doc);
    await frame(admin, session, seedNode, 1040, { kind: 'element', posterAssetId: null }, sheet('rect'));
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.getByTestId('gpu-canvas')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(8000);

    const viewBefore = await page.locator('[data-canvas-surface]').getAttribute('data-view');
    const result = await probe(page, () => pan(page, PAN_MS));
    expect(await page.locator('[data-canvas-surface]').getAttribute('data-view'), 'the pan moved the camera').not.toBe(viewBefore);
    console.log(`[steady] ${JSON.stringify(result)}`);
    expect(result.counts, 'no GPU card rebuilt, no texture fetched or uploaded').toEqual({});
    expect(result.remounts, 'no DOM tile, player or iframe mounted or unmounted').toBe(0);
    expect(result.requests, 'no network request at all while panning').toEqual([]);

    const away = await probe(page, async () => {
      const pane = (await page.locator('[data-canvas-surface]').boundingBox())!;
      await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height * 0.75);
      for (let i = 0; i < 40; i++) {
        await page.mouse.wheel(-120, 0);
      }
      await page.waitForTimeout(500);
      for (let i = 0; i < 40; i++) {
        await page.mouse.wheel(120, 0);
      }
      await page.waitForTimeout(1500);
    });
    console.log(`[steady-away] ${JSON.stringify(away)}`);
    expect(away.remounts, 'frames leaving and re-entering the view are not remounted').toBe(0);
    expect(away.requests, 'nor fetched again').toEqual([]);
  });

  test('a free box and a free text drag, resize and keep their place after a reload', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const box = await frame(admin, session, seedNode, 80, { kind: 'element', posterAssetId: null }, sheet('rect'));
    await admin.from('nodes').update({ width: 200, height: 120 }).eq('id', box.id);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.getByTestId('gpu-canvas')).toBeVisible({ timeout: 30_000 });
    const tile = page.locator(`.svelte-flow__node[data-id="${box.id}"]`);
    await expect(tile).toBeVisible();
    const rowOf = async () => (await admin.from('nodes').select('x, y, width, height').eq('id', box.id).single()).data!;
    const start = await rowOf();

    const b = (await tile.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 120, b.y + b.height / 2 + 60, { steps: 12 });
    await page.mouse.up();
    await expect.poll(async () => (await rowOf()).x, { timeout: 10_000, message: 'the drag moves the element node' }).not.toBe(start.x);
    const moved = await rowOf();

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await tile.click({ position: { x: 4, y: 4 } });
    const handle = tile.locator('.svelte-flow__resize-control.handle.bottom.right');
    if (await handle.count()) {
      const h = (await handle.boundingBox())!;
      await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
      await page.mouse.down();
      await page.mouse.move(h.x + 80, h.y + 40, { steps: 8 });
      await page.mouse.up();
      await expect.poll(async () => (await rowOf()).width, { timeout: 10_000, message: 'the resize lands' }).not.toBe(moved.width);
    }

    const settled = await rowOf();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.getByTestId('gpu-canvas')).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => (await rowOf()).x).toBe(settled.x);
    const shown = (await page.locator(`.svelte-flow__node[data-id="${box.id}"]`).getAttribute('data-box'))!.split(',').map(Number);
    expect(shown[0], 'no revert after reload').toBe(settled.x);
  });

  test('a marquee across nodes selects them, never their text', async ({ page, session, seedNode }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await seedNode({ type: 'text', x: 200, y: 200, data: { prompt: 'Some words to highlight' } });
    await seedNode({ type: 'text', x: 700, y: 200, data: { prompt: 'More words to highlight' } });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.getByTestId('gpu-canvas')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    const pane = (await page.locator('[data-canvas-surface]').boundingBox())!;
    await page.mouse.move(pane.x + 20, pane.y + 20);
    await page.mouse.down();
    await page.mouse.move(pane.x + pane.width - 40, pane.y + pane.height - 40, { steps: 20 });
    await page.mouse.up();
    expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
  });

  test('a wire ends on its ports at every zoom', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const text = await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: 'a' } });
    const image = await seedNode({ type: 'image', x: 700, y: 120, data: { prompt: 'b' } });
    expect((await admin.from('nodes_connections').insert({ org_id: session.orgId, canvas_id: session.canvasId, source_node_id: text.id, target_node_id: image.id, target_handle: 'text', actor_kind: 'user', actor_id: session.userId })).error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.getByTestId('gpu-canvas')).toBeVisible({ timeout: 30_000 });
    const pane = (await page.locator('[data-canvas-surface]').boundingBox())!;
    const zoomOf = async () => Number(((await page.locator('[data-canvas-surface]').getAttribute('data-view')) ?? '0,0,1').split(',')[2]);
    await page.locator('[data-canvas-surface]').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ControlOrMeta+a');
    for (const target of [0.2, 1, 2]) {
      await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
      await page.keyboard.down('Control');
      for (let i = 0; i < 200 && Math.abs((await zoomOf()) - target) / target > 0.05; i++) {
        await page.mouse.wheel(0, (await zoomOf()) < target ? -10 : 10);
      }
      await page.keyboard.up('Control');
      const gap = await page.evaluate(([from, to]) => {
        const path = document.querySelector<SVGPathElement>('.gpu-edges path')!;
        const m = path.getScreenCTM()!;
        const end = (t: number) => {
          const p = path.getPointAtLength(t * path.getTotalLength());
          return new DOMPoint(p.x, p.y).matrixTransform(m);
        };
        const port = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
        const out = port(`.svelte-flow__node[data-id="${from}"] .typed-port.port-out`);
        const inn = port(`.svelte-flow__node[data-id="${to}"] .typed-port.port-in`);
        const a = end(0);
        const b = end(1);
        return [Math.hypot(a.x - out.right, a.y - (out.top + out.height / 2)), Math.hypot(b.x - inn.left, b.y - (inn.top + inn.height / 2))];
      }, [text.id, image.id] as const);
      expect(Math.max(...gap), `wire ends within 2 px of its ports at zoom ${target}`).toBeLessThanOrEqual(2);
    }
  });
});
