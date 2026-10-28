import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOT_PREFIX } from './fixtures/shots';
import { setColour } from './fixtures/colour';

const SETTLE_MS = 2500;
const SAVE_MS = 4000;
const LIGHT = '#f5f5f5';
const DARK = '#111111';

const card = { id: 'card', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.3, height: 0.5, fill: '#888888', roundness: 0 } };
const chip = { id: 'chip', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.75, y: 0.5, width: 0.2, height: 0.3, fill: '#888888', roundness: 0 } };
const doc = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [card, chip] }], comps: {}, assets: [] };

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT_PREFIX.replace(/shot$/, 'vars')}-${name}.png` });
}

test.describe('variables on the canvas @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('a variable with two modes recolours a bound shape, and the switch is saved', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    const r = (await frame.boundingBox())!;
    const at = (fx: number, fy: number) => ({ x: r.x + r.width * fx, y: r.y + r.height * fy });

    const pickElement = async (fx: number, fy: number) => {
      await page.mouse.click(at(fx, fy).x, at(fx, fy).y);
      await page.waitForTimeout(SETTLE_MS);
      await page.mouse.click(at(fx, fy).x, at(fx, fy).y);
      await page.waitForTimeout(SETTLE_MS);
    };

    await page.mouse.click(at(0.5, 0.05).x, at(0.5, 0.05).y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(at(0.5, 0.05).x, at(0.5, 0.05).y);
    await page.getByText('Properties', { exact: true }).first().click();
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.getByTestId('variables-library')).toBeVisible({ timeout: 15_000 });
    await shot(page, 'library-empty');

    await page.getByTestId('variable-new-name').fill('surface');
    await page.getByTestId('variable-add-button').click();
    await expect(page.getByTestId('variable-row')).toHaveCount(1);
    await page.getByTestId('variable-new-mode-Collection').fill('Dark');
    await page.getByTestId('variable-add-mode-Collection').click();
    await setColour(page, page.getByTestId('variable-value-Collection-surface-Default'), LIGHT);
    await setColour(page, page.getByTestId('variable-value-Collection-surface-Dark'), DARK);
    await shot(page, 'library-two-modes');

    await pickElement(0.3, 0.5);
    await page.getByTestId('variable-pick').selectOption('Collection/surface');
    await page.getByTestId('variable-target').selectOption('fill');
    await page.getByTestId('variable-bind').click();
    await expect(page.getByTestId('variable-binding')).toHaveAttribute('data-target', 'fill');
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'bound-light');

    await page.keyboard.press('Escape');
    await page.getByTestId('variable-mode-Collection').selectOption('Dark');
    await page.waitForTimeout(SAVE_MS);
    await shot(page, 'bound-dark');

    const head = await admin.from('motion_revisions').select('doc, version').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
    const clips = (head.data!.doc as typeof doc).tracks[0].clips as { id: string; props: { fill: string }; bind?: Record<string, string> }[];
    expect(clips.find((c) => c.id === 'card')!.props.fill).toBe(DARK);
    expect(clips.find((c) => c.id === 'card')!.bind).toEqual({ fill: 'Collection/surface' });
    expect(clips.find((c) => c.id === 'chip')!.props.fill).toBe('#888888');
  });

  test('a collection defined in one frame is offered to the others, edits sync, and each frame keeps its own mode', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1800, height: 1000 });
    const seed = async (x: number) => {
      const node = await seedNode({ type: 'motion', x, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      return node;
    };
    const a = await seed(200);
    const b = await seed(800);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const select = async (id: string) => {
      const r = (await page.locator(`[data-frame="${id}"]`).boundingBox())!;
      const point = { x: r.x + r.width * 0.5, y: r.y + r.height * 0.05 };
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(SETTLE_MS);
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(SETTLE_MS);
    };
    const heads = async () => {
      const read = async (id: string) => (await admin.from('motion_revisions').select('doc, version').eq('node_id', id).order('version', { ascending: false }).limit(1).single()).data!.doc as { variables?: Record<string, { active?: string; vars: Record<string, { values: Record<string, string> }> }> };
      return { a: await read(a.id), b: await read(b.id) };
    };

    await select(a.id);
    await page.getByText('Properties', { exact: true }).first().click();
    await page.getByTestId('variable-new-name').fill('surface');
    await page.getByTestId('variable-add-button').click();
    await setColour(page, page.getByTestId('variable-value-Collection-surface-Default'), LIGHT);

    await page.waitForTimeout(SAVE_MS);
    expect((await heads()).a.variables!.Collection).toBeDefined();
    await select(b.id);
    await expect(page.getByTestId('variable-shared')).toHaveAttribute('data-collection', 'Collection', { timeout: 15_000 });
    await shot(page, 'shared-offered');
    await page.getByTestId('variable-use-Collection').click();
    await expect(page.getByTestId('variable-collection')).toHaveAttribute('data-collection', 'Collection');
    await page.getByTestId('variable-new-mode-Collection').fill('Dark');
    await page.getByTestId('variable-add-mode-Collection').click();
    await page.getByTestId('variable-mode-Collection').selectOption('Dark');
    await page.waitForTimeout(SAVE_MS);
    await shot(page, 'shared-b-dark');

    const saved = await heads();
    expect(saved.b.variables!.Collection.active).toBe('Dark');
    expect(saved.a.variables!.Collection.active).toBeUndefined();
    expect(saved.a.variables!.Collection.vars.surface.values.Dark).toBe(LIGHT);
  });
});
