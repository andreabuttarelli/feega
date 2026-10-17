import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const OPEN_TIMEOUT_MS = 20_000;
const IDLE_MS = 2_000;
const PLAY_MS = 1_500;
const MIN_PLAYED_S = 1;
const START = /^00:00:00 \//;

enum Start {
  Button = 'the Play button',
  Space = 'Space'
}

const START_PLAY: Record<Start, (page: Page) => Promise<void>> = {
  [Start.Button]: (page) => page.getByTestId('motion-editor').getByRole('button', { name: 'Play', exact: true }).click(),
  [Start.Space]: (page) => page.keyboard.press(' ')
};

function seconds(label: string, fps: number): number {
  const [mm, ss, ff] = label.split(' /')[0].split(':').map(Number);
  return mm * 60 + ss + ff / fps;
}

const stageShot = (page: Page) => page.getByTestId('editor-stage').screenshot();

async function expectPlays(page: Page, start: Start) {
  const editor = page.getByTestId('motion-editor');
  const timecode = editor.getByTestId('timecode');
  await editor.getByRole('button', { name: 'Go to start', exact: true }).click();
  await expect(timecode).toHaveText(START);
  await page.waitForTimeout(IDLE_MS);
  const still = await stageShot(page);

  await START_PLAY[start](page);
  await page.waitForTimeout(PLAY_MS);
  const played = seconds((await timecode.textContent())!, doc.fps);
  const moving = await stageShot(page);

  expect(played, 'the playhead advanced').toBeGreaterThan(MIN_PLAYED_S);
  expect(moving.equals(still), 'the rendered frame moved').toBe(false);
}

for (const start of [Start.Button, Start.Space]) {
  test.describe(`playing a frame with ${start} @real`, () => {
    test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
    test.setTimeout(90_000);

    test('inline on the canvas, the playhead advances past one second and the picture moves', async ({ page, session, admin, seedNode }) => {
      const node = await seedNode({ type: 'motion', x: 40, y: 120, data: LANDSCAPE });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      const stage = page.locator(`.svelte-flow__node[data-id="${node.id}"]`).getByTestId('motion-node-stage');
      await expect(stage).toBeVisible({ timeout: OPEN_TIMEOUT_MS });
      await page.waitForTimeout(IDLE_MS);
      const box = (await stage.boundingBox())!;
      await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);

      await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: OPEN_TIMEOUT_MS });
      await expectPlays(page, start);
    });

    test('the full editor plays too', async ({ page, session, admin, seedNode }) => {
      const node = await seedNode({ type: 'motion', x: 40, y: 120, data: LANDSCAPE });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
      await expect(page.getByTestId('timecode')).toBeVisible({ timeout: OPEN_TIMEOUT_MS });
      await expectPlays(page, start);
    });
  });
}
