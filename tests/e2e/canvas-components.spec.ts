import { homedir } from 'node:os';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { setColour } from './fixtures/colour';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;

const docWith = (clip: unknown) => ({
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [clip] }],
  comps: {},
  assets: []
});

const doc = docWith({ id: 'label', component: 'Text', from: 0, durationInFrames: 150, props: { text: 'Buy now', size: 0.12, x: 0.5, y: 0.5, width: 0.6, height: 0.25 } });
const BLUE = '#2244ff';
const boxDoc = docWith({ id: 'box', component: 'Shape', from: 0, durationInFrames: 150, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.5, height: 0.5, fills: [{ type: 'solid', color: BLUE, opacity: 1, visible: true, blend: 'normal' }] } });

type Clip = { component: string; hidden?: boolean; props: { comp?: string; overrides?: Record<string, { text?: string; hidden?: boolean; fills?: { color: string }[] }> } };
type Head = { tracks: { clips: Clip[] }[]; comps: Record<string, { component?: { name: string }; tracks: { clips: { id: string; props: Record<string, unknown> }[] }[] }> };

test.describe('components inside a canvas frame @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('⌥⌘K makes a component, its instance takes a text override', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await host.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('frame-selection').first()).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press('Alt+Meta+k');
    const inspector = page.getByTestId('instance-inspector');
    await expect(inspector).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('instance-text').fill('Sold out');
    await page.getByTestId('instance-text').press('Enter');
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/figD-components-1-instance.png` });

    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    const head = data?.[0]?.doc as Head;
    const instance = head.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;
    expect(head.comps[instance.props.comp!].component?.name).toBe('Component 1');
    expect(instance.props.overrides?.label?.text).toBe('Sold out');
  });

  test('an instance recolours and hides an element, each with its own reset', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: boxDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await host.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('frame-selection').first()).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press('Alt+Meta+k');
    await expect(page.getByTestId('instance-inspector')).toBeVisible({ timeout: 15_000 });
    await setColour(page, page.getByTestId('instance-fill'), '#ff0000');
    await expect(page.getByTestId('instance-reset-fills')).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/w2a-1-fill-override.png` });

    await page.getByTestId('instance-visible').uncheck();
    await expect(page.getByTestId('instance-reset-hidden')).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/w2a-1-hidden-override.png` });

    const saved = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
      const head = data?.[0]?.doc as Head;
      return head.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!.props.overrides?.box;
    };
    await expect.poll(saved, { timeout: 20_000 }).toMatchObject({ hidden: true, fills: [{ color: '#ff0000' }] });

    await page.getByTestId('instance-reset-hidden').click();
    await expect(page.getByTestId('instance-reset-hidden')).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/w2a-1-hidden-reset.png` });
    await expect.poll(saved, { timeout: 20_000 }).toEqual({ fills: [expect.objectContaining({ color: '#ff0000' })] });
  });

  test('dragging an element inside an instance records an override and leaves the main alone', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: boxDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await host.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.click(centre.x, centre.y);
    await expect(page.getByTestId('frame-selection').first()).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Alt+Meta+k');
    await expect(page.getByTestId('instance-inspector')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    await page.waitForTimeout(SETTLE_MS);
    const moved = (await host.boundingBox())!;
    centre.x = moved.x + moved.width / 2;
    centre.y = moved.y + moved.height / 2;
    await page.mouse.dblclick(centre.x, centre.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/w2a-2-inside-instance.png` });
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    await page.mouse.move(centre.x + 40, centre.y + 20, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/w2a-2-dragged-inside.png` });
    await page.mouse.click(centre.x, 100);
    await page.waitForTimeout(SETTLE_MS);

    const saved = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
      const head = data?.[0]?.doc as Head;
      const instance = head.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;
      const main = head.comps[instance.props.comp!].tracks.flatMap((t) => t.clips).find((c) => c.id === 'box')!;
      return { overrides: instance.props.overrides?.box, mainX: main.props.x };
    };
    await expect.poll(async () => (await saved()).overrides, { timeout: 20_000 }).toBeTruthy();
    expect((await saved()).mainX).toBe(0.5);
  });

  test('push to main turns an instance override into the main value', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await host.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('frame-selection').first()).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Alt+Meta+k');
    await expect(page.getByTestId('instance-inspector')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('instance-push')).toBeDisabled();

    await page.getByTestId('instance-text').fill('Sold out');
    await page.getByTestId('instance-text').press('Enter');
    await expect(page.getByTestId('instance-push')).toBeEnabled();
    await page.screenshot({ path: `${SHOTS}/w2a-3-before-push.png` });
    await page.getByTestId('instance-push').click();
    await expect(page.getByTestId('instance-push')).toBeDisabled();
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/w2a-3-after-push.png` });

    const saved = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
      const head = data?.[0]?.doc as Head;
      const instance = head.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')!;
      const main = head.comps[instance.props.comp!].tracks.flatMap((t) => t.clips).find((c) => c.id === 'label')!;
      return { overrides: instance.props.overrides, text: main.props.text };
    };
    await expect.poll(saved, { timeout: 20_000 }).toEqual({ overrides: undefined, text: 'Sold out' });
  });

  test('the Assets panel lists a component and dragging it onto another frame inserts an instance', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const data = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
    const source = await seedNode({ type: 'motion', x: 80, y: 80, data });
    const target = await seedNode({ type: 'motion', x: 80, y: 520, data });
    const empty = docWith({ id: 'note', component: 'Text', from: 0, durationInFrames: 150, props: { text: 'Note', size: 0.05, x: 0.2, y: 0.2, width: 0.2, height: 0.1 } });
    for (const [node, content] of [[source, boxDoc], [target, empty]] as const) {
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: content, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const from = page.locator(`[data-testid="frame-overlays"] [data-frame="${source.id}"]`);
    await expect(from).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await from.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('frame-selection').first()).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('Alt+Meta+k');
    await expect(page.getByTestId('instance-inspector')).toBeVisible({ timeout: 15_000 });
    await page.mouse.click(box.x + box.width / 2, 100);

    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    await page.getByText('Assets', { exact: true }).first().click();
    const row = page.getByTestId('component-row').first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${SHOTS}/w2a-4-assets-components.png` });

    const to = page.locator(`[data-testid="frame-overlays"] [data-frame="${target.id}"]`);
    await expect(to).toBeVisible();
    const drop = (await to.boundingBox())!;
    await row.dragTo(page.locator('[data-canvas-surface]'), { targetPosition: { x: drop.x + drop.width / 2 - (await page.locator('[data-canvas-surface]').boundingBox())!.x, y: drop.y + drop.height / 2 - (await page.locator('[data-canvas-surface]').boundingBox())!.y } });
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/w2a-4-dropped-instance.png` });

    const saved = async () => {
      const { data: rows } = await admin.from('motion_revisions').select('doc').eq('node_id', target.id).order('version', { ascending: false }).limit(1);
      const head = rows?.[0]?.doc as Head;
      return { instances: head.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Precomp').length, mains: Object.values(head.comps).filter((c) => c.component).length };
    };
    await expect.poll(saved, { timeout: 20_000 }).toEqual({ instances: 1, mains: 1 });
  });

  test('a property exposed on the main is set from the instance and saved', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await host.boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('frame-selection').first()).toBeVisible({ timeout: 15_000 });

    await page.keyboard.press('Alt+Meta+k');
    await expect(page.getByTestId('instance-inspector')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('instance-expose').filter({ hasText: 'Visible' }).click();
    const property = page.getByTestId('instance-property');
    await expect(property).toBeVisible();
    await property.getByTestId('instance-property-boolean').uncheck();
    await expect(property.getByTestId('instance-property-reset')).toBeVisible();
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/r4-1-property.png` });

    const saved = async () => {
      const { data: rows } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
      const head = rows?.[0]?.doc as { tracks: { clips: { component: string; props: { propValues?: Record<string, boolean> } }[] }[] };
      return Object.values(head.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp')?.props.propValues ?? {});
    };
    await expect.poll(saved, { timeout: 20_000 }).toEqual([false]);
  });
});
