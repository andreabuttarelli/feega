import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const MOTION_DATA = { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
const PAST_HEAD_POLL_MS = 4_000;

const sse = (parts: unknown[]) => [...parts.map((p) => `data: ${JSON.stringify(p)}\n\n`), 'data: [DONE]\n\n'].join('');

const edited = sse([{ type: 'start' }, { type: 'data-motion-doc', data: { edit: 1, doc } }, { type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'added a title' }, { type: 'text-end', id: 't' }, { type: 'finish' }]);

test.describe('motion agent live edits @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test("l'edit dell'agente arriva nell'editor e non torna al video vuoto quando il turno finisce", async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    const saved: string[] = [];

    await page.route(/\/motion\/[^/]+\/agent$/, (route) => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: edited });
    });
    page.on('request', (req) => {
      if (req.url().includes('?/save')) {
        saved.push(req.postData() ?? '');
      }
    });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
    await expect(page.getByTestId('empty-state')).toBeVisible();

    const input = page.getByLabel('Agent', { exact: true }).locator('textarea');
    await input.fill('a title');
    await input.press('Enter');

    await expect(page.getByTestId('empty-state')).toBeHidden();
    await page.waitForTimeout(PAST_HEAD_POLL_MS);
    await expect(page.getByTestId('empty-state')).toBeHidden();
    await expect.poll(() => saved.some((body) => body.includes('"text":"Motion"'))).toBe(true);
  });
});
