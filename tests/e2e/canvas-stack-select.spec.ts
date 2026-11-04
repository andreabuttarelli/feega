import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SETTLE_MS = 2500;
const SHOTS = join(homedir(), 'Documents', 'feega-videos', 'editor-modes');
const ELEMENT = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, kind: 'element' };
const textSheet = {
  version: 5,
  fps: 30,
  width: 480,
  height: 120,
  durationInFrames: 150,
  background: 'transparent',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 't', from: 0, durationInFrames: 150, component: 'Text', props: { text: 'Launch day', x: 0.5, y: 0.5, width: 1, height: 1, color: '#ffffff' } }] }]
};

const shot = (page: Page, name: string) => page.screenshot({ path: join(SHOTS, `stack-props-${name}.png`) });

test.describe('a Stack wrapping one text is selected on its own @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('Layers, canvas and Esc select the Stack, and its inspector edits its visuals', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 200, data: ELEMENT });
    await admin.from('nodes').update({ width: 480, height: 120, display_name: 'Text' }).eq('id', node.id);
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: textSheet, actor_kind: 'user', actor_id: session.userId });
    const live = async () => (await admin.from('nodes').select('id, display_name').eq('canvas_id', session.canvasId).is('deleted_at', null)).data ?? [];

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const tile = (await page.locator(`[data-frame="${node.id}"]`).boundingBox())!;
    await page.mouse.click(tile.x + tile.width / 2, tile.y + tile.height / 2);
    await page.getByTestId('more-actions').click();
    await page.locator('[data-action="wrap-stack"]').click();
    await expect.poll(async () => (await live()).map((n) => n.display_name), { timeout: 10_000 }).toEqual(['Stack']);
    const [stack] = await live();
    await page.waitForTimeout(SETTLE_MS);

    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    const stackRow = layers.locator(`[data-layer="${stack.id}"]`);
    const textRow = layers.locator('[data-layer="t"]');
    const head = page.getByTestId('layer-name');

    await textRow.click();
    await expect(textRow).toHaveAttribute('aria-selected', 'true');
    await expect(stackRow).toHaveAttribute('aria-selected', 'false');
    await expect(head).toHaveValue('Launch day');

    await stackRow.click();
    await expect(stackRow).toHaveAttribute('aria-selected', 'true');
    await expect(textRow).toHaveAttribute('aria-selected', 'false');
    await expect(head).toHaveValue('Stack');
    await shot(page, 'layers-select');

    await textRow.click();
    await expect(head).toHaveValue('Launch day');
    await page.mouse.move(tile.x - 40, tile.y - 40);
    await page.keyboard.press('Escape');
    await expect(head).toHaveValue('Stack');
    await expect(textRow).toHaveAttribute('aria-selected', 'false');

    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);
    const box = (await page.locator(`[data-frame="${stack.id}"]`).boundingBox())!;
    await page.mouse.click(box.x + 3, box.y + 3);
    await expect(head).toHaveValue('Stack');
    await expect(textRow).toHaveAttribute('aria-selected', 'false');
    await shot(page, 'canvas-select');

    const inspector = page.getByTestId('motion-inspector');
    for (const section of ['stack', 'fill', 'stroke', 'layer', 'effects']) {
      await expect(inspector.locator(`[data-section="${section}"]`)).toBeVisible();
    }

    for (const axis of ['x', 'y']) {
      const padding = page.getByTestId(`auto-layout-padding-${axis}`).locator('input');
      await padding.fill('16');
      await padding.dispatchEvent('change');
      await expect(padding).toHaveValue('16');
    }

    await page.getByTestId('fill-add').click();
    await page.getByRole('menuitem', { name: 'Solid', exact: true }).click();

    const radius = inspector.locator('[data-testid="radius"] input').first();
    await radius.fill('12');
    await radius.press('Enter');

    await page.getByTestId('stack-clip-content').check();

    await page.getByTestId('add-effect').click();
    await page.getByRole('menuitem', { name: 'Drop shadow', exact: true }).click();

    await expect.poll(async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', stack.id).order('version', { ascending: false }).limit(1).single();
      const root = (data!.doc as { tracks: { clips: { parent?: string; clipContent?: boolean; effects?: unknown[]; props: Record<string, unknown>; autoLayout?: { padding: { top: number } } }[] }[] }).tracks.flatMap((t) => t.clips).find((c) => !c.parent)!;
      return { clip: !!root.clipContent, effects: root.effects?.length ?? 0, fills: Array.isArray(root.props.fills) && root.props.fills.length > 0, padding: root.autoLayout?.padding.top, rounded: Number(root.props.roundness ?? 0) > 0 };
    }, { timeout: 15_000 }).toEqual({ clip: true, effects: 1, fills: true, padding: 16, rounded: true });

    const stackSection = inspector.locator('[data-section="stack"]');
    await stackSection.scrollIntoViewIfNeeded();
    for (const theme of ['light', 'dark']) {
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
      await page.waitForTimeout(300);
      await page.getByTestId('frame-inspector').screenshot({ path: join(SHOTS, `stack-inspector-${theme}.png`) });
    }
    await page.getByTestId('auto-layout-advanced').click();
    await expect(page.getByTestId('auto-layout-advanced-panel')).toBeVisible();
    await page.screenshot({ path: join(SHOTS, 'stack-inspector-settings-dark.png') });
    await page.getByTestId('auto-layout-advanced').click();
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await inspector.locator('[data-section="layer"]').scrollIntoViewIfNeeded();
    await shot(page, 'appearance');
    await page.locator('.svelte-flow__pane').hover({ position: { x: 10, y: 10 } });
    await page.keyboard.press('Shift+Digit2');
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'styled');
  });
});
