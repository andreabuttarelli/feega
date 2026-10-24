import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { AGENT_MENTION_ID } from '../../src/lib/canvas/comment-agent';

const SCREENSHOT = `${process.env.HOME}/Documents/feega-videos/e2e/f3-comment-agent.png`;

test.describe('@feega in comments @real', () => {
  test.skip(!REAL_STACK, 'requires E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('the composer offers @feega and an agent reply reads as feega, not as the commenter', async ({ page, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'text', x: 200, y: 160, data: { text: 'hello' } });
    const root = await admin
      .from('canvas_comments')
      .insert({ org_id: session.orgId, canvas_id: session.canvasId, node_id: node.id, author_id: session.userId, x: 0, y: 0, body: '@feega make this darker' })
      .select('id')
      .single();
    expect(root.error).toBeNull();
    const reply = await admin
      .from('canvas_comments')
      .insert({ org_id: session.orgId, canvas_id: session.canvasId, parent_id: root.data!.id, author_id: session.userId, x: 0, y: 0, body: 'Made it darker.', mentions: [AGENT_MENTION_ID] });
    expect(reply.error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('canvas-switcher').click();
    await page.getByTestId('canvas-comments').click();

    const thread = page.getByTestId('comment-thread');
    await expect(thread.getByTestId('comment-reply')).toContainText('feega');
    await expect(thread.getByTestId('comment-reply')).toContainText('Made it darker.');
    await expect(thread.getByTestId('comment-edit')).toHaveCount(1);

    await thread.getByTestId('comment-reply-input').fill('thanks @fe');
    await expect(thread.getByTestId('mention-option')).toHaveText('@feega');
    await page.screenshot({ path: SCREENSHOT });
  });
});
