import type { Page } from '@playwright/test';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { frameHost, heroDoc, openCanvas, seedFrame } from './seed';

const TEAMMATE = { id: '00000000-0000-4000-8000-0000000000b1', name: 'Bruno' };


async function lendTeammate(page: Page) {
  await page.route(/\/canvases\/[^/?]+\?action=canvasComments/, async (route) => {
    const response = await route.fetch();
    const data = (await response.json()) as { teammates: unknown[] };
    return route.fulfill({ response, json: { ...data, teammates: [...data.teammates, TEAMMATE] } });
  });
}

test('comments with mentions and timeline markers', async ({ page, session, admin, seedNode }) => {
  const id = await seedFrame(seedNode, admin, session, { x: 200, y: 80 }, heroDoc(60));
  await lendTeammate(page);
  await installCursor(page);
  await openCanvas(page, session);
  const box = (await frameHost(page, id).boundingBox())!;

  await recordDemo(page, { slug: 'comments-timeline', title: 'comments on the timeline' }, async (d) => {
    await d.click({ x: box.x + box.width * 0.73, y: box.y + box.height * 0.45 });
    await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 15_000 });
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.wait(1600);
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.click(page.getByTestId('frame-timeline-pin'));
    const draft = page.getByTestId('comment-draft');
    await d.type(draft, 'The CTA lands late, bring it in with the title');
    await d.click(page.getByTestId('comment-add'));
    await expect(page.getByTestId('frame-timeline-mark')).toHaveCount(1);
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.wait(1200);
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.click(page.getByTestId('frame-timeline-mark'));
    await d.wait(1200);
    await page.keyboard.press('Alt+1');
    await d.click(page.getByTestId('canvas-more'));
    await d.click(page.getByTestId('canvas-comments'));
    const panelDraft = page.getByTestId('comments-panel').getByTestId('comment-draft');
    await d.type(panelDraft, 'Ping @Br');
    await panelDraft.fill('Ping @Br');
    await d.click(page.getByTestId('mention-option').first());
    await panelDraft.press('End');
    await d.type(panelDraft, 'can you tighten this before Friday', { click: false });
    await d.click(page.getByTestId('comments-panel').getByTestId('comment-add'));
    await d.wait(1500);
  });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
