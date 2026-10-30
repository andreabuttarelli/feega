import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';

const SHOTS = `${process.env.HOME}/Documents/feega-videos/e2e`;
const TEAMMATE = { id: '00000000-0000-4000-8000-0000000000b1', name: 'Bruno' };
const FUTURE = '2099-01-01T00:00:00.000Z';

const mentionOfMe = (me: string) => ({ id: 'injected-1', number: 99, nodeId: null, authorId: TEAMMATE.id, x: 0, y: 0, body: `@you look at this`, resolved: false, timeMs: null, mentions: [me], editedAt: null, createdAt: FUTURE, replies: [] });

async function lendTeammate(page: Page, me: string) {
  await page.route(/\/canvases\/[^/?]+\?action=canvasComments/, async (route) => {
    const response = await route.fetch();
    const data = (await response.json()) as { threads: unknown[]; teammates: unknown[] };
    const patched = { ...data, threads: [...data.threads, mentionOfMe(me)], teammates: [...data.teammates, TEAMMATE] };
    return route.fulfill({ response, json: patched });
  });
}

test.describe('comment edit, delete and mentions @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('mention picker, edit and delete own comments, notification dot', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await lendTeammate(page, session.userId);
    const addBodies: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('action=addComment')) {
        addBodies.push(req.postData() ?? '');
      }
    });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.getByTestId('comments-unseen')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: `${SHOTS}/comments3-unseen-dot.png` });

    await page.keyboard.press('Alt+1');
    await page.getByTestId('canvas-more').click();
    await page.getByTestId('canvas-comments').click();
    await expect(page.getByTestId('comments-panel')).toBeVisible();
    await expect(page.getByTestId('comments-unseen')).toHaveCount(0);

    await page.getByTestId('comment-draft').fill('Ping @Br');
    await page.getByTestId('mention-option').click();
    await expect(page.getByTestId('comment-draft')).toHaveValue('Ping @Bruno ');
    await page.getByTestId('comment-draft').fill('Ping @Bruno ok');
    await page.getByTestId('comment-add').click();
    const mine = page.getByTestId('comment-thread').first();
    await expect(mine).toContainText('Ping @Bruno ok');
    expect(addBodies.join('\n')).toContain(TEAMMATE.id);
    await page.screenshot({ path: `${SHOTS}/comments3-mention.png` });

    await mine.getByTestId('comment-edit').click();
    await mine.getByTestId('comment-edit-input').fill('Ping again');
    await mine.getByTestId('comment-edit-save').click();
    await expect(mine.getByTestId('comment-body')).toContainText('Ping again');
    await expect(mine.getByTestId('comment-edited')).toBeVisible();
    await expect.poll(async () => (await admin.from('canvas_comments').select('body, edited_at').eq('canvas_id', session.canvasId)).data?.[0]).toMatchObject({ body: 'Ping again' });
    await page.screenshot({ path: `${SHOTS}/comments3-edited.png` });

    await mine.getByTestId('comment-delete').click();
    await expect(page.getByTestId('comment-thread')).toHaveCount(1);
    await expect.poll(async () => (await admin.from('canvas_comments').select('deleted_at').eq('canvas_id', session.canvasId)).data?.[0]?.deleted_at).not.toBeNull();
    await expect(page.getByTestId('comment-thread').filter({ hasText: 'look at this' }).getByTestId('comment-edit')).toHaveCount(0);

    await page.reload();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.getByTestId('project-switcher')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('comments-unseen')).toHaveCount(0);
  });
});
