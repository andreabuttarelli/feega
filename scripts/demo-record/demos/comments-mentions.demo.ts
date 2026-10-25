import type { Page } from '@playwright/test';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { frameDoc, frameHost, openCanvas, seedFrame, solid } from './seed';

const TEAMMATE = { id: '00000000-0000-4000-8000-0000000000b1', name: 'Bruno' };

const shape = (id: string, from: number, x: number, color: string) => ({ id, from, durationInFrames: 150 - from, component: 'Shape', props: { shape: 'rect', x, y: 0.5, width: 0.25, height: 0.4, fills: solid(color) } });

async function lendTeammate(page: Page) {
  await page.route(/\/canvases\/[^/?]+\?action=canvasComments/, async (route) => {
    const response = await route.fetch();
    const data = (await response.json()) as { teammates: unknown[] };
    return route.fulfill({ response, json: { ...data, teammates: [...data.teammates, TEAMMATE] } });
  });
}

test('comments with mentions and timeline markers', async ({ page, session, admin, seedNode }) => {
  const id = await seedFrame(seedNode, admin, session, { x: 200, y: 80 }, frameDoc([shape('first', 0, 0.3, '#3b82f6'), shape('later', 60, 0.7, '#ff5a1f')]));
  await lendTeammate(page);
  await installCursor(page);
  await openCanvas(page, session);
  const box = (await frameHost(page, id).boundingBox())!;

  await recordDemo(page, { slug: 'comments-timeline', title: 'comments on the timeline' }, async (d) => {
    await d.click({ x: box.x + box.width * 0.3, y: box.y + box.height * 0.5 });
    await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 15_000 });
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.wait(1600);
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.click(page.getByTestId('frame-timeline-pin'));
    const draft = page.getByTestId('comment-draft');
    await d.type(draft, 'Orange lands late here');
    await d.click(page.getByTestId('comment-add'));
    await expect(page.getByTestId('frame-timeline-mark')).toHaveCount(1);
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.wait(1200);
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.click(page.getByTestId('frame-timeline-mark'));
    await d.wait(1200);
    await d.click(page.getByTestId('canvas-switcher'));
    await d.click(page.getByTestId('canvas-comments'));
    const panelDraft = page.getByTestId('comments-panel').getByTestId('comment-draft');
    await d.type(panelDraft, 'Ping @Br');
    await panelDraft.fill('Ping @Br');
    await d.click(page.getByTestId('mention-option').first());
    await d.type(panelDraft, 'can you check the timing?', { click: false });
    await d.click(page.getByTestId('comments-panel').getByTestId('comment-add'));
    await d.wait(1500);
  });
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});
