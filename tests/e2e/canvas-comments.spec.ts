import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = `${process.env.HOME}/Documents/feega-videos/e2e`;

test.describe('canvas comments @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('add a comment, pin it to a node, reply, resolve', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'text', x: 200, y: 160, data: { text: 'hello' } });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.keyboard.press('Alt+1');
    await page.getByTestId('canvas-more').click();
    await page.getByTestId('canvas-comments').click();
    const panel = page.getByTestId('comments-panel');
    await expect(panel).toContainText('No comments yet');

    await page.getByTestId('comment-draft').fill('Move this to the left');
    await page.getByTestId('comment-add').click();
    await expect(page.getByTestId('comment-thread')).toContainText('Move this to the left');
    await expect(page.getByTestId('comment-pin')).toHaveCount(1);

    await page.locator(`.gpu-node[data-id="${node.id}"]`).click({ position: { x: 200, y: 4 } });
    await page.getByTestId('comment-draft').fill('This one is on the node');
    await page.getByTestId('comment-add').click();
    await expect(page.locator(`.gpu-node[data-id="${node.id}"] [data-testid="comment-pin"]`)).toHaveCount(1);
    await expect.poll(async () => (await admin.from('canvas_comments').select('node_id').eq('canvas_id', session.canvasId).eq('node_id', node.id)).data?.length).toBe(1);

    const first = page.getByTestId('comment-thread').filter({ hasText: 'Move this to the left' });
    await first.getByTestId('comment-reply-input').fill('Done');
    await first.getByTestId('comment-reply-send').click();
    await expect(first.getByTestId('comment-reply')).toContainText('Done');
    await page.screenshot({ path: `${SHOTS}/comments-thread.png` });

    await first.getByTestId('comment-resolve').click();
    await expect(page.getByTestId('comment-thread')).toHaveCount(1);
    await expect(page.getByTestId('comment-pin')).toHaveCount(1);

    await page.getByTestId('comment-show-resolved').click();
    await expect(page.getByTestId('comment-thread')).toHaveCount(2);
    await page.screenshot({ path: `${SHOTS}/comments-resolved.png` });
  });
});
