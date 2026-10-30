import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/breakpoints-edit`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const VIEWPORT = { width: 2200, height: 1000 };
const SETTLE_MS = 6000;
const PHONE = 'ph';
const HEADING = { x: 0.5, y: 0.3 };
const BASE_SIZE = 0.07;
const PHONE_PX = '22';

const shape = (id: string, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: [{ type: 'solid', color }] } });
const heading = { id: 'heading', from: 0, durationInFrames: 150, component: 'Text', props: { text: 'Plan your launch', size: BASE_SIZE, x: HEADING.x, y: HEADING.y, width: 0.8, height: 0.16, color: '#ffffff', font: 'sans', align: 'center' } };

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('bg', '#14213d'), heading] }],
  comps: {},
  assets: [],
  breakpoints: [{ id: PHONE, name: 'Phone', width: 390 }]
};

const snap = async (page: Page, name: string) => {
  mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOTS_DIR}/${name}.png` });
};

test.describe('an element edited inside a breakpoint view changes that view only @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('select the heading in the Phone view, change its font size, desktop keeps its size', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize(VIEWPORT);
    page.on('pageerror', (e) => console.log('PAGEERR', e.message));
    page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 300)));
    const node = await seedNode({ type: 'motion', x: 100, y: 200, data: LANDSCAPE });
    await admin.from('nodes').update({ width: 800, height: 450 }).eq('id', node.id);
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    const phone = page.locator(`[data-frame="${node.id}@bp:${PHONE}"]`);
    await expect(phone).toHaveCount(1, { timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    await snap(page, '1-views');

    const box = (await phone.boundingBox())!;
    await page.mouse.click(box.x + box.width * HEADING.x, box.y + box.height * HEADING.y);
    await page.waitForTimeout(1000);
    await page.getByRole('tab', { name: 'Properties' }).or(page.getByRole('button', { name: 'Properties', exact: true })).first().click();
    await expect(page.getByTestId('editing-breakpoint')).toHaveText('Editing: Phone');
    await snap(page, '2-selected-in-phone');

    const size = page.locator('[data-testid="frame-inspector"] [data-prop="size"] input').first();
    await size.fill(PHONE_PX);
    await size.press('Enter');
    await page.waitForTimeout(SETTLE_MS);
    await expect(page.getByTestId('breakpoint-override')).toContainText('Font size');
    await snap(page, '3-phone-font-size');

    const { data } = await admin.from('motion_revisions').select('doc, version').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
    const saved = (data!.doc as typeof doc).tracks[0].clips.find((c) => c.id === 'heading') as typeof heading & { overrides?: Record<string, Record<string, number>> };
    expect(saved.props.size).toBe(BASE_SIZE);
    expect(saved.overrides?.[PHONE]?.['props.size']).toBeDefined();
  });
});
