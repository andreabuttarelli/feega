import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const MOTION_DATA = { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
const ASK = { role: 'user', content: 'a title' };

test.describe('motion agent turn resumed after a reload @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test("ricaricando a metà turno l'editor mostra il lavoro dell'agente, e alla fine la revisione salvata", async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    let running = true;

    await page.route(/\/motion\/[^/]+\/agent$/, (route) => {
      if (route.request().method() !== 'GET') {
        return route.fallback();
      }
      const body = running
        ? { threadId: 't', running: true, messages: [ASK, { role: 'assistant', content: 'Adding a title', streaming: true }], parts: [{ type: 'data-motion-doc', data: { edit: 1, doc } }], head: { version: 0, doc: null, summary: null, actorKind: 'system' } }
        : { threadId: 't', running: false, messages: [ASK, { role: 'assistant', content: 'Added a title.' }], parts: [], head: { version: 1, doc, summary: 'added a title', actorKind: 'agent' } };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
    await page.reload();

    await expect(page.getByText('Adding a title')).toBeVisible();
    await expect(page.getByTestId('clip-bar')).toHaveCount(1);

    running = false;
    await expect(page.getByText('Added a title.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('clip-bar')).toHaveCount(1);
    await expect(page.getByTestId('empty-state')).toBeHidden();
  });
});
