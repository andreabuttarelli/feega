import type { Frame, Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const STEPS = ['#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#808080', '#123456', '#fedcba'];
const STEP_GAP_MS = 120;
const FRAME_MS = 1000 / 60;
const LIVE_BUDGET_MS = 3 * FRAME_MS;
const OPS = 'ops';
const OUT = process.env.COLOUR_DRAG_OUT;

const box = {
  id: 'box',
  from: 0,
  durationInFrames: 150,
  component: 'Shape',
  props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.7, height: 0.6, fills: [{ type: 'solid', color: '#ff0000' }] }
};

const doc = {
  version: 5,
  fps: 30,
  width: 1080,
  height: 1350,
  durationInFrames: 150,
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [box] }],
  comps: {},
  assets: []
};

const rgbOf = (hex: string) => `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`;

async function stageFrame(page: Page): Promise<Frame> {
  let found: Frame | null = null;
  await expect
    .poll(async () => {
      for (const frame of page.frames()) {
        if (await frame.evaluate(() => !!document.querySelector('#sv-box')).catch(() => false)) {
          found = frame;
          return true;
        }
      }
      return false;
    }, { timeout: 20_000 })
    .toBe(true);
  return found!;
}

async function watchFill(frame: Frame) {
  await frame.evaluate(() => {
    const w = window as unknown as { painted: Record<string, number> };
    w.painted = {};
    const tick = () => {
      for (const el of document.querySelectorAll('#sv-box [style*="fill"], #sv-box [fill]')) {
        const fill = getComputedStyle(el).fill;
        w.painted[fill] ??= performance.timeOrigin + performance.now();
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

for (const renderer of ['gpu', 'dom']) {
  test.describe(`colour drag paints live on the ${renderer} canvas @real`, () => {
    test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
    test.setTimeout(120_000);

    test('every picker step paints within a few frames, nothing saves until release, release saves one revision', async ({ page, session, admin, seedNode }) => {
      const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}?renderer=${renderer}`);
      const stage = page.locator(`[data-id="${node.id}"]`).getByTestId('motion-node-stage');
      await expect(stage).toBeVisible({ timeout: 20_000 });
      const at = (await stage.boundingBox())!;
      await page.mouse.dblclick(at.x + at.width / 2, at.y + at.height / 2);
      await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 20_000 });

      await page.getByRole('tab', { name: 'Properties' }).click();
      const stack = page.getByTestId('motion-inspector').getByTestId('fill-stack').first();
      await stack.getByTestId('fill-row').first().getByTestId('fill-swatch').click();
      const editor = page.getByTestId('fill-editor');
      await editor.locator('.colour .chip').first().click();
      const wheel = page.getByTestId('colour-popover').locator('input[type=color]');
      await expect(wheel).toBeVisible();

      const frame = await stageFrame(page);
      await watchFill(frame);
      await expect.poll(() => frame.evaluate((rgb) => (window as unknown as { painted: Record<string, number> }).painted[rgb] ?? null, rgbOf('#ff0000'))).not.toBeNull();
      const saves: number[] = [];
      page.on('request', (r) => {
        if (r.method() === 'POST' && new URL(r.url()).searchParams.get('action') === OPS) {
          saves.push(Date.now());
        }
      });

      const lags: number[] = [];
      for (const hex of STEPS) {
        const sentAt = await wheel.evaluate((el: HTMLInputElement, value) => {
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return performance.timeOrigin + performance.now();
        }, hex);
        await expect.poll(() => frame.evaluate((rgb) => (window as unknown as { painted: Record<string, number> }).painted[rgb] ?? null, rgbOf(hex)), { timeout: 5_000, intervals: [10] }).not.toBeNull();
        const paintedAt = await frame.evaluate((rgb) => (window as unknown as { painted: Record<string, number> }).painted[rgb], rgbOf(hex));
        lags.push(paintedAt - sentAt);
        await page.waitForTimeout(STEP_GAP_MS);
      }
      expect(saves, 'nothing is saved while dragging').toHaveLength(0);

      const last = STEPS.at(-1)!;
      await wheel.evaluate((el: HTMLInputElement) => el.dispatchEvent(new Event('change', { bubbles: true })));
      await expect
        .poll(async () => {
          const { data } = await admin.from('motion_revisions').select('version, doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
          const head = data?.[0];
          return head ? [head.version, (head.doc as typeof doc).tracks[0].clips[0].props.fills[0].color] : null;
        }, { timeout: 15_000 })
        .toEqual([2, last]);
      await page.waitForTimeout(1500);
      expect(saves, 'one save for the whole drag').toHaveLength(1);

      const sorted = [...lags].sort((a, b) => a - b);
      const report = { renderer, lagsMs: lags.map((l) => Math.round(l)), medianMs: Math.round(sorted[Math.floor(sorted.length / 2)]), maxMs: Math.round(sorted.at(-1)!) };
      console.log(`[colour-drag] ${JSON.stringify(report)}`);
      if (OUT) {
        await page.screenshot({ path: `${OUT}/colour-drag-${renderer}.png` });
      }
      expect(report.medianMs, 'a step paints within a few frames').toBeLessThan(LIVE_BUDGET_MS);
    });
  });
}
