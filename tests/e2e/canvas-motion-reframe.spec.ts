import { mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const landscape = (posterAssetId: string) => ({ format: '16:9', docHeadRevision: 1, posterAssetId, lastRenderAssetId: null });
const POSTER = { width: 480, height: 270 };

async function storedPoster(admin: import('@supabase/supabase-js').SupabaseClient, session: { orgId: string; projectId: string }): Promise<string> {
  const jpeg = await sharp({ create: { ...POSTER, channels: 3, background: { r: 40, g: 40, b: 40 } } }).jpeg().toBuffer();
  const path = `${session.orgId}/${session.projectId}/${crypto.randomUUID()}.jpg`;
  expect((await admin.storage.from('canvas-assets').upload(path, jpeg, { contentType: 'image/jpeg' })).error).toBeNull();
  const asset = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'upload', url: path, mime_type: 'image/jpeg' }).select('id').single();
  expect(asset.error).toBeNull();
  return asset.data!.id;
}
const ZOOMS = [0.25, 0.5, 1, 2];
const ZOOM_TOLERANCE = 0.1;
const MAX_ZOOM_STEPS = 20;
const DRIFT_PX = 1.5;
const SAMPLE_MS = 2500;
const SHOTS = process.env.CANVAS_REFRAME_SHOTS;

const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
};

type Box = { x: number; y: number; width: number; height: number };
type Frame = { t: number; host: Box | null; stage: Box | null; picture: Box | null; frame: Box | null };

const drift = (a: Box | null, b: Box | null) => (a && b ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.width - b.width), Math.abs(a.height - b.height)) : 0);

const scaleOf = (page: Page) => page.locator('.svelte-flow__viewport').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);

async function zoomTo(page: Page, target: number) {
  await page.locator('.svelte-flow__pane').click({ position: { x: 5, y: 5 } });
  const seen: number[] = [];
  for (let i = 0; i < MAX_ZOOM_STEPS; i++) {
    const scale = await scaleOf(page);
    seen.push(scale);
    if (Math.abs(scale - target) / target < ZOOM_TOLERANCE) {
      return;
    }
    await page.keyboard.press(scale > target ? '-' : '+');
    await page.waitForTimeout(250);
  }
  throw new Error(`could not zoom the canvas to ${target}: ${seen.join(' ')}`);
}

async function recordPaintedFrames(page: Page) {
  await page.evaluate((ms) => {
    const rect = (el: Element | null | undefined) => {
      if (!el) {
        return null;
      }
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const frames: Frame[] = [];
    (window as unknown as { __frames: Frame[] }).__frames = frames;
    const start = performance.now();
    const afterPaint = () => {
      const player = document.querySelector('[data-testid=editor-stage] hyperframes-player') as (HTMLElement & { iframeElement?: HTMLIFrameElement }) | null;
      const sized = player?.iframeElement?.style.width ? player.iframeElement : null;
      frames.push({
        t: performance.now() - start,
        host: rect(document.querySelector('[data-testid=motion-node-editing]')),
        stage: rect(document.querySelector('[data-testid=editor-stage]')),
        picture: rect(document.querySelector('[data-testid=editor-stage] [data-testid=motion-preview]')),
        frame: rect(sized)
      });
      if (performance.now() - start < ms) {
        requestAnimationFrame(() => setTimeout(afterPaint, 0));
      }
    };
    requestAnimationFrame(() => setTimeout(afterPaint, 0));
  }, SAMPLE_MS);
}

async function paintedFrames(page: Page): Promise<Frame[]> {
  await page.waitForTimeout(SAMPLE_MS + 200);
  return page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);
}

async function open(page: Page, stage: Locator, touch: boolean) {
  const box = (await stage.boundingBox())!;
  const view = page.viewportSize()!;
  const left = Math.max(box.x, 0);
  const top = Math.max(box.y, 0);
  const position = { x: (left + Math.min(box.x + box.width, view.width)) / 2 - box.x, y: (top + Math.min(box.y + box.height, view.height)) / 2 - box.y };
  const drawnByPosterLayer = !(await stage.isVisible());
  if (drawnByPosterLayer) {
    const at = { x: box.x + position.x, y: box.y + position.y };
    await (touch ? page.touchscreen.tap(at.x, at.y) : page.mouse.click(at.x, at.y));
    await expect(stage, 'zoomed out the poster layer draws the frame; selecting it brings the frame back').toBeVisible();
  }
  if (touch) {
    if (!drawnByPosterLayer) {
      await stage.tap({ position });
    }
    await stage.dblclick({ position });
    return;
  }
  await stage.click({ position });
}

for (const [name, use] of Object.entries(DEVICES)) {
  test.describe(`a frame node keeps its picture on the node while the canvas reframes, ${name} @real`, () => {
    test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
    test.use(use);

    for (const zoom of ZOOMS) {
      test(`opened from canvas zoom ${zoom}`, async ({ page, session, admin, seedNode }) => {
        const node = await seedNode({ type: 'motion', x: 80, y: 120, data: landscape(await storedPoster(admin, session)) });
        const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
        expect(error).toBeNull();
        await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

        await zoomTo(page, zoom);
        const stage = page.locator(`.svelte-flow__node[data-id="${node.id}"]`).getByTestId('motion-node-stage');
        if (SHOTS) {
          mkdirSync(SHOTS, { recursive: true });
          await page.screenshot({ path: `${SHOTS}/${name}-${zoom}-closed.png` });
        }

        await recordPaintedFrames(page);
        await open(page, stage, name === 'phone');
        await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
        const frames = await paintedFrames(page);

        const placed = frames.filter((f) => f.host && f.stage);
        expect(placed.length, 'the editor stage appeared while sampling').toBeGreaterThan(10);
        const worstStage = placed.reduce((worst, f) => (drift(f.stage, f.host) > drift(worst.stage, worst.host) ? f : worst));
        expect(drift(worstStage.stage, worstStage.host), `the player layer sat off the node at ${Math.round(worstStage.t)} ms: ${JSON.stringify(worstStage)}`).toBeLessThanOrEqual(DRIFT_PX);

        const drawn = frames.filter((f) => f.frame && f.picture);
        const worstFrame = drawn.reduce((worst, f) => (drift(f.frame, f.picture) > drift(worst.frame, worst.picture) ? f : worst), drawn[0]);
        expect(drawn.length, 'the player drew while sampling').toBeGreaterThan(0);
        expect(drift(worstFrame.frame, worstFrame.picture), `the video frame did not fill the picture box at ${Math.round(worstFrame.t)} ms: ${JSON.stringify(worstFrame)}`).toBeLessThanOrEqual(DRIFT_PX * 2);

        if (SHOTS) {
          await page.screenshot({ path: `${SHOTS}/${name}-${zoom}-open.png` });
        }
      });
    }
  });
}
