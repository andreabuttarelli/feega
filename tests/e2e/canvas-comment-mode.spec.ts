import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = `${process.env.HOME}/Documents/feega-videos/e2e`;

test.describe('canvas comment mode @real', () => {
  test.skip(!REAL_STACK, 'needs a real stack: E2E_REAL_STACK=1');

  test('C then a click drops a pin on the node under the cursor, or on the canvas', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'text', x: 200, y: 160, data: { text: 'hello' } });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`.gpu-node[data-id="${node.id}"]`).waitFor();

    await page.keyboard.press('c');
    await expect(page.getByTestId('comment-mode')).toHaveAttribute('aria-pressed', 'true');

    const box = (await page.locator(`.gpu-node[data-id="${node.id}"]`).boundingBox())!;
    await page.mouse.click(box.x + 30, box.y + 20);
    await expect(page.locator(`.gpu-node[data-id="${node.id}"] [data-testid="comment-pin-pending"]`)).toHaveCount(1);
    await page.getByTestId('comment-draft').fill('On the node, near the top left');
    await page.screenshot({ path: `${SHOTS}/comments2-mode-pending.png` });
    await page.getByTestId('comment-add').click();
    await expect(page.locator(`.gpu-node[data-id="${node.id}"] [data-testid="comment-pin"]`)).toHaveCount(1);

    const saved = (await admin.from('canvas_comments').select('node_id, x, y').eq('canvas_id', session.canvasId).eq('node_id', node.id)).data ?? [];
    expect(saved).toHaveLength(1);
    expect(saved[0].x).toBeGreaterThan(0);
    expect(saved[0].x).toBeLessThan(box.width);

    await page.keyboard.press('c');
    await page.mouse.click(box.x + 100, box.y + box.height + 80);
    await page.getByTestId('comment-draft').fill('Out on the open canvas');
    await page.getByTestId('comment-add').click();
    await expect.poll(async () => ((await admin.from('canvas_comments').select('id').eq('canvas_id', session.canvasId).is('node_id', null)).data ?? []).length).toBe(1);
    await expect(page.getByTestId('comment-mode')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('comment-pin')).toHaveCount(2);
    await page.screenshot({ path: `${SHOTS}/comments2-mode-placed.png` });
  });
});
