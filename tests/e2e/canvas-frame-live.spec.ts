import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };
import { DEFAULT_INTERACTIVE } from '../../src/lib/motion/interactive/settings';
import { INPUT_MESSAGE } from '../../src/lib/motion/interactive/runtime';
import { PLAYER_MESSAGE, PlayerEvent } from '../../src/lib/motion/interactive/protocol';
import { InputKey } from '../../src/lib/motion/expression/inputs';

const LIVE_TIMEOUT_MS = 30_000;

const frameData = (interactive: boolean) => ({ format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, interactive });
const nodeOf = (page: Page, id: string) => page.locator(`.svelte-flow__node[data-id="${id}"]`);

type Seen = { times: number[]; down: boolean };

async function listen(page: Page) {
  await page.addInitScript(
    ({ input, player, timeupdate, down }) => {
      const seen = { times: [] as number[], down: false };
      (window as unknown as { __seen: typeof seen }).__seen = seen;
      addEventListener('message', (e) => {
        if (e.data?.type === player && e.data.event === timeupdate) {
          seen.times.push(e.data.time);
        }
        if (e.data?.type === input && e.data.values?.[down] === 1) {
          seen.down = true;
        }
      });
    },
    { input: INPUT_MESSAGE, player: PLAYER_MESSAGE, timeupdate: PlayerEvent.TimeUpdate, down: InputKey.PointerDown }
  );
}

async function seen(page: Page): Promise<Seen[]> {
  return Promise.all(page.frames().map((f) => f.evaluate(() => (window as unknown as { __seen?: Seen }).__seen ?? { times: [], down: false }).catch(() => ({ times: [], down: false }))));
}

test.describe('an interactive frame played live on the canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('only an interactive frame has Play; on it runs and reacts to a click without the editor, off brings the picture back', async ({ page, session, admin, seedNode }) => {
    const live = await seedNode({ type: 'motion', x: 40, y: 140, data: frameData(true) });
    const plain = await seedNode({ type: 'motion', x: 40, y: 520, data: frameData(false) });
    for (const [node, interactive] of [[live, true], [plain, false]] as const) {
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: interactive ? { ...doc, interactive: DEFAULT_INTERACTIVE } : doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }
    await listen(page);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    await expect(nodeOf(page, live.id).getByTestId('frame-live-switch')).toBeVisible();
    await expect(nodeOf(page, plain.id).getByTestId('frame-live-switch')).toHaveCount(0);

    await nodeOf(page, live.id).getByTestId('frame-live-toggle').click();
    const running = nodeOf(page, live.id).getByTestId('frame-live');
    await expect(running).toBeVisible();
    await expect.poll(async () => Math.max(0, ...(await seen(page)).flatMap((s) => s.times)), { timeout: LIVE_TIMEOUT_MS, message: 'time advances' }).toBeGreaterThan(0.5);

    const box = (await running.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect.poll(async () => (await seen(page)).some((s) => s.down), { timeout: 10_000, message: 'the frame reads the press' }).toBe(true);
    await page.mouse.up();

    await expect(page.getByTestId('motion-editor'), 'no editor opened').toHaveCount(0);
    await expect(nodeOf(page, live.id), 'the press went to the frame, not to the canvas').not.toHaveClass(/selected/);

    await nodeOf(page, live.id).getByTestId('frame-live-toggle').click();
    await expect(running, 'off is back to the picture').toHaveCount(0);

    await nodeOf(page, live.id).getByTestId('frame-live-toggle').click();
    await expect(running).toBeVisible();
    await page.locator('body').press('Escape');
    await expect(running, 'Esc turns it off').toHaveCount(0);
  });
});
