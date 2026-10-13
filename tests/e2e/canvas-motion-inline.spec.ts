import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const START = /^00:00:00 \//;
const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const PHONE = { width: 390, height: 844 };
const TABLET = { width: 820, height: 1180 };

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

const latestVersion = async (admin: Parameters<Parameters<typeof test>[2]>[0]['admin'], nodeId: string) =>
  (await admin.from('motion_revisions').select('version').eq('node_id', nodeId).order('version', { ascending: false }).limit(1)).data?.[0]?.version ?? 0;

const JPEG = 'data:image/jpeg;base64,';
const sse = (parts: unknown[]) => [...parts.map((p) => `data: ${JSON.stringify(p)}\n\n`), 'data: [DONE]\n\n'].join('');
const askFrames = (callId: string) => sse([{ type: 'start' }, { type: 'data-motion-frames', data: { callId, times: [0.5, 1.5], doc } }, { type: 'finish' }]);

const OPEN_AGENT: Record<'phone' | 'tablet', (page: Page) => Promise<void>> = {
  phone: (page) => page.getByRole('navigation', { name: 'Panels' }).getByRole('button', { name: 'Agent' }).click(),
  tablet: (page) => page.getByTestId('toggle-chat').click()
};

const viewportTransform = (page: Page) => page.locator('.svelte-flow__viewport').evaluate((el) => getComputedStyle(el).transform);

test.use({ video: SHOTS ? 'on' : 'off' });

test.describe('motion editor inside the canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test.beforeEach(async ({ session, admin, seedNode }, info) => {
    for (const x of [80, 470]) {
      const node = await seedNode({ type: 'motion', x, y: 120, data: LANDSCAPE });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      info.annotations.push({ type: 'node', description: node.id });
    }
  });

  test('the node becomes the editor player; timeline, keys and undo follow focus; the canvas stays live', async ({ page, session, admin }, info) => {
    const [first, second] = info.annotations.filter((a) => a.type === 'node').map((a) => a.description!);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await shoot(page, '1-canvas');

    const nodeOf = (id: string) => page.locator(`.svelte-flow__node[data-id="${id}"]`);
    await nodeOf(first).getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });

    const editor = page.getByTestId('motion-editor');
    await expect(editor).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
    await expect(nodeOf(first).getByTestId('editor-stage')).toBeVisible();
    await expect(page.getByTestId('motion-preview')).toHaveCount(1);
    await expect(page).toHaveURL(new RegExp(`/c/${session.canvasId}$`));
    await expect(page.getByRole('region', { name: 'Timeline', exact: true })).toBeVisible();
    await expect(page.getByLabel('Agent', { exact: true })).toBeVisible();
    await page.waitForTimeout(1500);
    await shoot(page, '2-open');

    const timecode = editor.getByTestId('timecode');
    await editor.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(timecode).not.toHaveText(START, { timeout: 5000 });
    await shoot(page, '3-playing');
    await editor.getByRole('button', { name: 'Pause', exact: true }).click();

    await editor.locator('[data-clip-id]').first().click();
    await page.keyboard.press('Delete');
    await expect(editor.locator('[data-clip-id]')).toHaveCount(0);
    await expect.poll(() => latestVersion(admin, first), { timeout: 10_000 }).toBeGreaterThan(1);
    await shoot(page, '4-edited');

    await page.keyboard.press('ControlOrMeta+z');
    await expect(editor.locator('[data-clip-id]')).toHaveCount(1);
    expect((await admin.from('nodes').select('deleted_at').eq('id', first).single()).data?.deleted_at).toBeNull();

    const before = await viewportTransform(page);
    await page.mouse.move(640, 120);
    await page.mouse.wheel(0, -100);
    await expect.poll(() => viewportTransform(page)).not.toBe(before);
    await expect(editor).toBeVisible();

    await nodeOf(second).getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(nodeOf(second).getByTestId('editor-stage')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('motion-preview')).toHaveCount(1);
    await shoot(page, '5-switched');

    const empty = await page.evaluate(() => {
      for (let y = 60; y < innerHeight; y += 20) {
        for (let x = 80; x < innerWidth; x += 20) {
          if (document.elementFromPoint(x, y)?.classList.contains('svelte-flow__pane')) {
            return { x, y };
          }
        }
      }
      return null;
    });
    expect(empty).not.toBeNull();
    await page.mouse.click(empty!.x, empty!.y);
    await expect(editor).toHaveCount(0);
    await shoot(page, '6-closed');
  });

  test('the agent sees frames captured by the player inside the node', async ({ page, session }, info) => {
    const [first] = info.annotations.filter((a) => a.type === 'node').map((a) => a.description!);
    const stored: string[] = [];
    await page.route(/\/motion\/[^/]+\/agent$/, (route) =>
      route.request().method() === 'POST' ? route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: askFrames('call_inline') }) : route.fallback()
    );
    page.on('response', (res) => {
      if (!res.url().endsWith('/agent/frames') || !res.ok()) {
        return;
      }
      const body = res.request().postDataJSON() as { callId: string; frames: { data: string }[] };
      if (body.frames.length === 2 && body.frames.every((f) => f.data.startsWith(JPEG))) {
        stored.push(body.callId);
      }
    });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`.svelte-flow__node[data-id="${first}"]`).getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    const input = page.getByLabel('Agent', { exact: true }).locator('textarea');
    await input.fill('look');
    await input.press('Enter');
    await expect.poll(() => stored, { timeout: 20_000 }).toContain('call_inline');
  });

  for (const [name, size] of [['phone', PHONE], ['tablet', TABLET]] as const) {
    test(`on a ${name} the node is the player and the panels fit`, async ({ page, session }) => {
      await page.setViewportSize(size);
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await page.getByTestId('motion-node-stage').first().click({ position: { x: 60, y: 10 } });

      const editor = page.getByTestId('motion-editor');
      await expect(editor).toHaveAttribute('data-viewport', name, { timeout: 15_000 });
      await expect(page.getByTestId('motion-node').first().getByTestId('editor-stage')).toBeAttached();
      await expect(page.getByRole('region', { name: 'Timeline', exact: true })).toBeVisible();
      await page.waitForTimeout(1500);
      await page.waitForTimeout(2500);
      await shoot(page, `${name}-open`);

      await OPEN_AGENT[name](page);
      await expect(page.getByLabel('Agent', { exact: true })).toBeVisible();
      await shoot(page, `${name}-agent`);
    });
  }
});
