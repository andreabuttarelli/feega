import type { Page } from '@playwright/test';
import { pickBarTool, pickFrameTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };

const WATCH_MS = 3000;
const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const TOOLS = ['rectangle', 'ellipse', 'text'] as const;

test.use({ video: process.env.E2E_VIDEO ? 'on' : 'off' });

type Watch = { frames: number; blank: number[]; swaps: number; saved: boolean };

async function watchFreeElement(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __watch: { frames: number; blank: number[]; nodes: Set<Element>; saved: boolean; armed: boolean } };
    w.__watch = { frames: 0, blank: [], nodes: new Set(), saved: false, armed: false };
    const painted = (node: Element) => {
      const img = node.querySelector('[data-testid=motion-node-poster]') as HTMLImageElement | null;
      if (img?.complete && img.naturalWidth > 0) {
        return true;
      }
      if (node.querySelector('[data-drawn="true"]')) {
        return true;
      }
      const stage = document.querySelector('[data-testid=editor-stage]') as HTMLElement | null;
      return !node.querySelector('[data-testid=motion-node-skeleton]') && stage?.dataset.shown === 'true';
    };
    new PerformanceObserver((list) => {
      if (list.getEntries().some((e) => e.name.includes('?/drawElement'))) {
        w.__watch.saved = true;
      }
    }).observe({ type: 'resource' });
    document.addEventListener('pointerup', () => (w.__watch.armed = true), { capture: true, once: true });
    const tick = () => {
      if (w.__watch.armed) {
        const node = document.querySelector('[data-kind="element"]');
        const ghost = document.querySelector('[data-testid=draw-overlay] .ghost');
        if (node) {
          w.__watch.nodes.add(node);
        }
        if (!ghost && !(node && painted(node))) {
          w.__watch.blank.push(w.__watch.frames);
        }
        w.__watch.frames += 1;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function readWatch(page: Page): Promise<Watch> {
  return page.evaluate(() => {
    const w = (window as unknown as { __watch: { frames: number; blank: number[]; nodes: Set<Element>; saved: boolean } }).__watch;
    return { frames: w.frames, blank: w.blank, swaps: w.nodes.size, saved: w.saved };
  });
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
}

test.describe('an inserted shape never blinks @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  for (const tool of TOOLS) {
    test(`a ${tool} drawn on the free canvas shows in every frame, on one DOM node, through its save`, async ({ page, session, admin }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await pickBarTool(page, tool);
      await watchFreeElement(page);
      const pane = (await page.locator('.svelte-flow').boundingBox())!;
      const from = { x: pane.x + pane.width * 0.35, y: pane.y + pane.height * 0.35 };
      await drag(page, from, { x: from.x + 240, y: from.y + 120 });
      await page.waitForTimeout(WATCH_MS);

      const watch = await readWatch(page);
      expect(watch.saved, 'the save came back').toBe(true);
      expect(watch.blank, `frames with nothing drawn, of ${watch.frames}`).toEqual([]);
      expect(watch.swaps, 'the save does not remount the element').toBe(1);
      const rows = (await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).is('deleted_at', null)).data ?? [];
      expect(rows).toHaveLength(1);
    });
  }

  test('a rectangle drawn inside a frame shows in every frame, without reloading the frame', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
    await page.addInitScript(() => {
      if (window.top === window) {
        return;
      }
      const w = window as unknown as { __shown: [number, number][] };
      w.__shown = [];
      const tick = () => {
        const shown = [...document.querySelectorAll('[data-clip]')].filter((c) => (c as HTMLElement).getBoundingClientRect().width > 0).length;
        w.__shown.push([performance.timeOrigin + performance.now(), shown]);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    const overlay = page.getByTestId('selection-overlay');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 30_000 });
    const box = (await overlay.boundingBox())!;
    await page.evaluate(() => {
      const w = window as unknown as { __ghost: [number, boolean][]; __player: Element | null; __players: Set<Element | null> };
      w.__ghost = [];
      w.__players = new Set();
      const tick = () => {
        w.__ghost.push([performance.timeOrigin + performance.now(), !!document.querySelector('[data-testid=draw-overlay] .ghost')]);
        w.__players.add(document.querySelector('[data-testid=editor-stage] hyperframes-player'));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    await pickFrameTool(page, 'rectangle');
    const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });
    const before = Date.now();
    await drag(page, at(0.3, 0.5), at(0.6, 0.7));
    await page.waitForTimeout(WATCH_MS);

    const ghost = await page.evaluate(() => (window as unknown as { __ghost: [number, boolean][] }).__ghost);
    const players = await page.evaluate(() => (window as unknown as { __players: Set<Element | null> }).__players.size);
    const frame = page.frames().find((f) => f !== page.mainFrame() && f.url() === 'about:srcdoc');
    const shown = await Promise.all(page.frames().filter((f) => f !== page.mainFrame()).map((f) => f.evaluate(() => (window as unknown as { __shown?: [number, number][] }).__shown ?? []).catch(() => [])));
    const clips = shown.reduce((a, b) => (b.length > a.length ? b : a), [] as [number, number][]);
    expect(frame, 'the frame keeps one live player').toBeTruthy();
    const baseline = clips.find(([t]) => t >= before)?.[1] ?? 0;
    const drawnAt = ghost.find(([, on]) => on)?.[0] ?? before;
    const landedAt = clips.find(([t, n]) => t >= drawnAt && n > baseline)?.[0] ?? Infinity;
    const dark = ghost.filter(([t, on]) => t >= drawnAt && t < landedAt && !on).length;
    expect(dark, 'frames with neither the drawing nor the shape').toBe(0);
    expect(clips.filter(([t, n]) => t >= landedAt && n <= baseline), 'the shape never leaves after it lands').toEqual([]);
    expect(players, 'no player remount').toBe(1);
  });
});
