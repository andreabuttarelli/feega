import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const FRAMES = 21;
const CHAT_BUDGET_MS = 3000;
const SETTLE_MS = 30_000;

type Marks = { open: number; chat?: number };

function installProbe() {
  const t: Marks = { open: 0 };
  (window as unknown as { __chat: Marks }).__chat = t;
  addEventListener(
    'pointerdown',
    (e) => {
      if ((e.target as Element).closest?.('.svelte-flow__node')) {
        t.open = e.timeStamp;
      }
    },
    true
  );
  new MutationObserver(() => {
    const log = document.querySelector('[data-testid=motion-editor] aside.chat [role=log]');
    if (t.chat === undefined && log && !log.querySelector('.skeleton')) {
      t.chat = performance.now();
    }
  }).observe(document, { subtree: true, childList: true });
}

async function chatReadyAfterOpen(page: Page): Promise<number> {
  const marks = () => page.evaluate(() => (window as unknown as { __chat: Marks }).__chat);
  await expect.poll(async () => (await marks()).chat !== undefined, { timeout: SETTLE_MS }).toBe(true);
  const t = await marks();
  return t.chat! - t.open;
}

test.describe('motion chat loads fast @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test.beforeEach(async ({ session, admin, seedNode }, info) => {
    for (let i = 0; i < FRAMES; i++) {
      const node = await seedNode({ type: 'motion', x: 80 + (i % 4) * 400, y: 120 + Math.floor(i / 4) * 300, data: LANDSCAPE });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      info.annotations.push({ type: 'node', description: node.id });
    }
  });

  test('a frame opened on the canvas shows its chat within the budget', async ({ page, session }, info) => {
    const first = info.annotations.find((a) => a.type === 'node')!.description!;
    await page.addInitScript(installProbe);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`.svelte-flow__node[data-id="${first}"]`).getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });

    expect(await chatReadyAfterOpen(page)).toBeLessThan(CHAT_BUDGET_MS);
  });
});
