import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const WIDTH = poster.width;

type Clip = { id: string; component: string; props: Record<string, unknown>; transform: Record<string, number> };
type Pt = { x: number; y: number };

async function geometry(shape: Locator) {
  return shape.evaluate((el: SVGGraphicsElement) => {
    const svg = el.ownerSVGElement!;
    const view = svg.viewBox.baseVal;
    const rect = svg.getBoundingClientRect();
    const b = el.getBBox();
    const sx = view.width ? rect.width / view.width : 1;
    const sy = view.height ? rect.height / view.height : 1;
    return { x: rect.left + (b.x - view.x) * sx, y: rect.top + (b.y - view.y) * sy, width: b.width * sx, height: b.height * sy };
  });
}

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('feega.frame-edit-mode', 'design'));
});

test.describe('draw polish inside a frame @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  async function open({ page, session, admin, seedNode }: { page: Page; session: { orgId: string; userId: string; projectId: string; canvasId: string }; admin: import('@supabase/supabase-js').SupabaseClient; seedNode: (n: Record<string, unknown>) => Promise<{ id: string }> }) {
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    const clips = async (): Promise<Clip[]> => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
      const doc = data?.[0]?.doc as { tracks: { clips: Clip[] }[] } | undefined;
      return doc?.tracks.flatMap((t) => t.clips) ?? [];
    };
    const shapes = async (shape: string) => (await clips()).filter((c) => c.component === 'Shape' && c.props.shape === shape);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    const overlay = page.getByTestId('selection-overlay');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    const box = (await overlay.boundingBox())!;
    const at = (fx: number, fy: number): Pt => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });

    async function drag(from: Pt, to: Pt) {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
      await page.mouse.move(to.x, to.y);
      await page.mouse.up();
    }

    async function rect(from: Pt, to: Pt, count: number) {
      await page.getByTestId('draw-tools').locator('[data-tool="rectangle"]').click();
      await drag(from, to);
      await expect.poll(async () => (await shapes('rect')).length, { timeout: 10_000 }).toBe(count);
    }

    return { clips, shapes, at, drag, rect };
  }

  test('a rectangle rounds one corner from Properties and another from its handle on the canvas', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const { shapes, at, drag, rect } = await open({ page, session, admin, seedNode });

    await rect(at(0.2, 0.3), at(0.7, 0.6), 1);
    await page.getByRole('tab', { name: 'Properties' }).click();
    await page.getByTestId('radius-per-corner').click();
    const corners = page.getByTestId('corners');
    await expect(corners).toBeVisible({ timeout: 10_000 });
    await corners.locator('[data-corner="0"]').fill('30');
    await corners.locator('[data-corner="0"]').press('Enter');
    await expect.poll(async () => (await shapes('rect'))[0].props.corners, { timeout: 10_000 }).toEqual([0.3, 0, 0, 0]);

    const handle = page.getByTestId('corner-overlay').locator('[data-corner="2"]');
    await expect(handle).toBeVisible();
    const h = (await handle.boundingBox())!;
    await drag({ x: h.x + h.width / 2, y: h.y + h.height / 2 }, { x: h.x - 30, y: h.y - 30 });
    await expect.poll(async () => ((await shapes('rect'))[0].props.corners as number[])[2], { timeout: 10_000 }).toBeGreaterThan(0.05);
    expect(((await shapes('rect'))[0].props.corners as number[])[0]).toBe(0.3);
    await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true');
    await shoot(page, '30-corner-radius');
  });

  test('the pen adds a point on a segment and Delete removes the selected point', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const { shapes, at } = await open({ page, session, admin, seedNode });
    const points = async () => (String((await shapes('path'))[0]?.props.path ?? '').match(/[ML]/g) ?? []).length;

    await page.getByTestId('draw-tools').locator('[data-tool="pen"]').click();
    for (const [fx, fy] of [
      [0.2, 0.2],
      [0.8, 0.2],
      [0.5, 0.6]
    ]) {
      const p = at(fx, fy);
      await page.mouse.click(p.x, p.y);
    }
    const first = at(0.2, 0.2);
    await page.mouse.click(first.x, first.y);
    await expect.poll(points, { timeout: 10_000 }).toBe(3);

    await expect(page.getByTestId('pen-overlay')).toBeVisible({ timeout: 10_000 });
    const mid = at(0.5, 0.2);
    await page.mouse.click(mid.x, mid.y);
    await expect.poll(points, { timeout: 10_000 }).toBe(4);
    await expect(page.getByTestId('pen-overlay').locator('.point.sel')).toHaveCount(1);
    await shoot(page, '31-pen-add-point');

    await page.keyboard.press('Backspace');
    await expect.poll(points, { timeout: 10_000 }).toBe(3);
    expect(await shapes('path')).toHaveLength(1);
  });

  test('a dragged pen shape keeps its path outline and points on the drawn shape', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const { shapes, at, drag } = await open({ page, session, admin, seedNode });
    const TOLERANCE_PX = 2;

    await page.getByTestId('draw-tools').locator('[data-tool="pen"]').click();
    for (const [fx, fy] of [
      [0.1, 0.1],
      [0.7, 0.1],
      [0.4, 0.6],
      [0.1, 0.1]
    ]) {
      const p = at(fx, fy);
      await page.mouse.click(p.x, p.y);
    }
    await expect.poll(async () => (await shapes('path')).length, { timeout: 10_000 }).toBe(1);
    await expect(page.getByTestId('pen-overlay')).toBeVisible({ timeout: 10_000 });
    await shoot(page, '35-pen-before-drag');

    await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 15_000 });
    await drag(at(0.3, 0.2), at(0.5, 0.45));
    await expect.poll(async () => (await shapes('path'))[0].transform?.x ?? 0, { timeout: 10_000 }).toBeGreaterThan(0.1);
    await page.waitForTimeout(500);
    await shoot(page, '36-pen-after-drag');

    const rendered = page.getByTestId('selection-box');
    const outline = page.getByTestId('pen-path');
    await expect
      .poll(async () => {
        const [r, o] = [await geometry(rendered), await geometry(outline)];
        return Math.max(Math.abs(r.x - o.x), Math.abs(r.y - o.y), Math.abs(r.width - o.width), Math.abs(r.height - o.height));
      }, { timeout: 10_000 })
      .toBeLessThanOrEqual(TOLERANCE_PX);

    const o = await geometry(outline);
    const first = (await page.getByTestId('pen-overlay').locator('[data-point="0.0"]').boundingBox())!;
    expect(Math.abs(first.x + first.width / 2 - o.x)).toBeLessThanOrEqual(TOLERANCE_PX);
    expect(Math.abs(first.y + first.height / 2 - o.y)).toBeLessThanOrEqual(TOLERANCE_PX);
  });

  test('arrows nudge the selection in Design and step frames in Motion', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const { shapes, at, rect } = await open({ page, session, admin, seedNode });
    const x = async () => (await shapes('rect'))[0].transform?.x ?? 0;

    await rect(at(0.3, 0.3), at(0.6, 0.5), 1);
    await page.getByTestId('edit-mode').locator('[data-mode="design"]').click();
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect.poll(x, { timeout: 10_000 }).toBeCloseTo(11 / WIDTH, 5);
    await shoot(page, '32-arrow-nudge');

    await page.getByTestId('edit-mode').locator('[data-mode="motion"]').click();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1500);
    expect(await x()).toBeCloseTo(11 / WIDTH, 5);
  });

  test('a drag shows distance labels; Align left lines the selection up', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const { shapes, at, rect } = await open({ page, session, admin, seedNode });
    const left = (c: Clip) => (Number(c.props.x) - Number(c.props.width) / 2 + (c.transform?.x ?? 0)) * WIDTH;

    await rect(at(0.1, 0.2), at(0.3, 0.3), 1);
    await rect(at(0.5, 0.6), at(0.8, 0.7), 2);

    await expect(page.getByTestId('selection-box'), 'the new rectangle is measured before it is dragged').toBeVisible({ timeout: 15_000 });
    const from = at(0.65, 0.65);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y + 10);
    await page.mouse.move(from.x + 20, from.y + 15);
    await expect(page.getByTestId('gap-label').first()).toBeVisible();
    await shoot(page, '33-smart-guides');
    await page.mouse.up();

    await page.keyboard.press('Meta+a');
    await page.getByRole('tab', { name: 'Properties' }).click();
    const bar = page.getByTestId('align-bar');
    await expect(bar).toBeVisible();
    await shoot(page, '34-align-bar');
    await bar.locator('[data-align="left"]').click();
    await expect.poll(async () => (await shapes('rect')).map((c) => Math.abs(Math.round(left(c)))), { timeout: 10_000 }).toEqual([0, 0]);
  });
});
