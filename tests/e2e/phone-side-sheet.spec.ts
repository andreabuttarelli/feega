import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';
import motion from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PHONES = [
  { name: 'iphone', width: 390, height: 844 },
  { name: 'android', width: 412, height: 915 }
];
const SHOTS = process.env.SIDE_PANEL_SHOTS;

const shapeDoc = (id: string, shape: string) => ({
  version: 5,
  fps: 30,
  width: 200,
  height: 200,
  durationInFrames: 150,
  background: 'transparent',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape, x: 0.5, y: 0.5, width: 1, height: 1 } }] }],
  comps: {},
  assets: []
});

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/after-${name}.png` });
  }
}

async function below(sheet: Locator, stage: Locator) {
  const picked = stage.page().getByTestId('selection-box');
  const shown = (await picked.count()) ? picked.first() : stage;
  await expect
    .poll(async () => (await sheet.boundingBox())!.y - ((await shown.boundingBox())!.y + (await shown.boundingBox())!.height), { timeout: 5_000, message: 'the sheet opens at peek, under what is selected' })
    .toBeGreaterThanOrEqual(-1);
}

async function backToCanvas(page: Page) {
  await page.getByTestId('inline-close').click();
  await expect(page.getByTestId('motion-editor')).toHaveCount(0, { timeout: 10_000 });
}

test.use({ actionTimeout: 15_000, video: process.env.E2E_VIDEO ? 'on' : 'off' });

test.describe('on a phone Properties and Chat are one tap away @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack reale: E2E_REAL_STACK=1');

  for (const phone of PHONES) {
    test(`${phone.name}: canvas, frame, element in a frame, free element, group`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(240_000);
      await page.setViewportSize({ width: phone.width, height: phone.height });
      const frame = await seedNode({ type: 'motion', x: 20, y: 60, data: LANDSCAPE });
      await admin.from('nodes').update({ display_name: 'Hero' }).eq('id', frame.id);
      await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: motion, actor_kind: 'user', actor_id: session.userId });
      const elements: string[] = [];
      for (const [i, [shape, name]] of [['rect', 'Box'], ['ellipse', 'Ellipse']].entries()) {
        const node = await seedNode({ type: 'motion', x: 40 + i * 160, y: 360, data: { ...LANDSCAPE, kind: 'element' } });
        await admin.from('nodes').update({ width: 120, height: 120, display_name: name }).eq('id', node.id);
        await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: shapeDoc(`s${i}`, shape), actor_kind: 'user', actor_id: session.userId });
        elements.push(node.id);
      }
      const group = await seedNode({ type: 'motion', x: 40, y: 540, data: { ...LANDSCAPE, kind: 'group' } });
      await admin.from('nodes').update({ width: 120, height: 120, display_name: 'Group' }).eq('id', group.id);
      await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: group.id, version: 1, doc: shapeDoc('g0', 'rect'), actor_kind: 'user', actor_id: session.userId });

      const viewProps = page.getByTestId('mobile-view-properties');
      const viewChat = page.getByTestId('mobile-view-chat');
      const props = page.locator('aside.props');
      const chat = page.locator('aside.chat');
      const tabProps = page.getByTestId('phone-tab-properties');
      const tabChat = page.getByTestId('phone-tab-chat');
      const stage = page.getByTestId('editor-stage');

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await expect(viewProps, '(a) properties is always in the view switch').toBeVisible();
      await expect(viewProps, '(a) with nothing selected it has nothing to show').toBeDisabled();
      await expect(viewChat).toBeVisible();
      await shoot(page, `${phone.name}-a-browsing`);

      await page.locator(`[data-motion-node="${frame.id}"]`).click();
      await expect(viewProps, '(b) a selected frame lights properties up').toBeEnabled();
      await viewChat.click();
      await expect(page.getByTestId('canvas-chat-editing'), '(b) the canvas chat knows the selection').toHaveText('Editing: Hero');
      await shoot(page, `${phone.name}-b-chat-knows`);
      await page.getByTestId('mobile-view-canvas').click();
      await viewProps.click();
      await expect(props, '(b) properties opens the frame on its Properties').toBeVisible({ timeout: 20_000 });
      await expect(stage).toHaveAttribute('data-shown', 'true', { timeout: 30_000 });
      await below(props, stage);
      await shoot(page, `${phone.name}-b-frame-properties`);

      await expect(tabProps, '(c) the frame has its own Properties tab').toHaveAccessibleName('Properties');
      await expect(tabChat, '(c) and its own Chat tab').toHaveAccessibleName('Chat');
      await tabChat.click();
      await expect(chat, '(c) Chat is one tap away').toBeVisible();
      await expect(props).toBeHidden();
      await expect(page.getByTestId('add-bar'), '(c) the draw tools step aside for an open sheet').toBeHidden();
      await expect(page.getByTestId('chat-editing'), '(c) the chat knows the frame').toHaveText('Editing: Hero');
      await shoot(page, `${phone.name}-c-frame-chat`);

      await stage.click();
      await expect(props, '(d) selecting an element snaps back to Properties, even over Chat').toBeVisible();
      await below(props, stage);
      await shoot(page, `${phone.name}-d-element-properties`);
      await tabChat.click();
      await expect(page.getByTestId('chat-editing'), '(d) the chat knows the element').toHaveText('Editing: Motion');
      await backToCanvas(page);

      await page.locator(`[data-motion-node="${elements[0]}"]`).click();
      await expect(viewProps, '(e) a free element lights properties up').toBeEnabled();
      await viewProps.click();
      await expect(props.getByTestId('selection-head'), '(e) on the element itself').toContainText('Shape', { timeout: 20_000 });
      await below(props, stage);
      await shoot(page, `${phone.name}-e-free-element`);
      await backToCanvas(page);

      await page.locator(`[data-motion-node="${group.id}"]`).click();
      await expect(viewProps, '(f) a group lights properties up').toBeEnabled();
      await viewProps.click();
      await expect(props, '(f) the group opens on its Properties').toBeVisible({ timeout: 20_000 });
      await below(props, stage);
      await shoot(page, `${phone.name}-f-group`);
      await tabProps.click();
      await expect(props).toBeHidden();
      const bar = (await page.getByTestId('add-bar').boundingBox())!;
      const tabs = (await tabProps.boundingBox())!;
      expect(bar.y + bar.height, '(f) the draw tools sit above the tabs, not on them').toBeLessThanOrEqual(tabs.y + 1);
    });
  }
});
