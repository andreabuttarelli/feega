import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const MOTION_DATA = { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
const ANSWER_WITHIN_MS = 20_000;
const JPEG = 'data:image/jpeg;base64,';

const sse = (parts: unknown[]) => [...parts.map((p) => `data: ${JSON.stringify(p)}\n\n`), 'data: [DONE]\n\n'].join('');

const askFrames = (callId: string) => sse([{ type: 'start' }, { type: 'data-motion-frames', data: { callId, times: [0.5, 1.5], doc } }, { type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'looked' }, { type: 'text-end', id: 't' }, { type: 'finish' }]);

test.describe('motion agent frames @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test("l'editor aperto risponde a ogni richiesta di frame dell'agente, e il server li conserva", async ({ page, session, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    const stored: string[] = [];
    let asked = 0;

    await page.route(/\/motion\/[^/]+\/agent$/, (route) => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      asked += 1;
      return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: askFrames(`call_${asked}`) });
    });
    page.on('response', (res) => {
      if (!res.url().endsWith('/agent/frames') || !res.ok()) {
        return;
      }
      const body = res.request().postDataJSON() as { callId: string; frames: { data: string }[] };
      if (body.frames.length === 2 && body.frames.every((f) => f.data.startsWith(JPEG))) {
        stored.push(body.callId);
      }
    });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
    const input = page.getByLabel('Agent', { exact: true }).locator('textarea');

    for (const n of [1, 2]) {
      await input.fill(`look ${n}`);
      await input.press('Enter');
      await expect.poll(() => stored, { timeout: ANSWER_WITHIN_MS }).toContain(`call_${n}`);
    }
  });
});
