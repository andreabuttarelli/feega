import { test, expect, REAL_STACK, gotoHydrated, signInE2e } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const DESKTOP = { width: 1280, height: 860 };
const CURSOR_LATENCY_MS = 1000;
const COMMIT_LATENCY_MS = 200;
const ELEMENT = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, kind: 'element' };

test.use({ viewport: DESKTOP, actionTimeout: 15_000 });

test.describe('canvas cursors across two tabs @real', () => {
  test.skip(!REAL_STACK, 'richiede lo stack vero: E2E_REAL_STACK=1');
  test.setTimeout(90_000);

  test('a pointer in one tab shows as a cursor in the other, and leaves with it', async ({ page, session }) => {
    const path = `/p/${session.projectId}/c/${session.canvasId}`;
    const other = await page.context().newPage();
    await gotoHydrated(page, path);
    await gotoHydrated(other, path);
    await page.waitForTimeout(1500);

    const started = Date.now();
    for (let i = 0; i < 10; i += 1) {
      await page.mouse.move(400 + i * 10, 400);
    }
    const cursor = other.getByTestId('peer-cursor');
    await expect(cursor).toBeVisible({ timeout: CURSOR_LATENCY_MS * 5 });
    console.log(JSON.stringify({ cursorLatencyMs: Date.now() - started }));
    expect(Date.now() - started).toBeLessThan(CURSOR_LATENCY_MS * 5);

    await page.close();
    await expect(cursor).toHaveCount(0, { timeout: 15_000 });
  });

  test('a drag in one tab moves the real node in the other, and it lands without jumping back', async ({ page, session, seedNode, admin }) => {
    const node = await seedNode({ type: 'motion', x: 120, y: 160, data: ELEMENT });
    await admin.from('nodes').update({ width: 120, height: 120 }).eq('id', node.id);
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    const path = `/p/${session.projectId}/c/${session.canvasId}`;
    const other = await page.context().newPage();
    await gotoHydrated(page, path);
    await gotoHydrated(other, path);
    await page.waitForTimeout(1500);

    const tile = page.locator(`.svelte-flow__node[data-id="${node.id}"]`);
    const box = (await tile.boundingBox())!;
    const from = { x: box.x + 60, y: box.y + 60 };
    const peerTile = other.locator(`.svelte-flow__node[data-id="${node.id}"]`);
    const before = (await peerTile.boundingBox())!;
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    const started = Date.now();
    await page.mouse.move(from.x + 200, from.y + 100, { steps: 20 });
    await expect.poll(async () => (await peerTile.boundingBox())!.x - before.x, { timeout: 5000, intervals: [20] }).toBeGreaterThan(150);
    console.log(JSON.stringify({ liveMoveLatencyMs: Date.now() - started }));
    const mid = (await peerTile.boundingBox())!;
    await page.mouse.up();
    const xs: number[] = [];
    const sampling = (async () => { for (let i = 0; i < 40; i += 1) { xs.push((await peerTile.boundingBox())!.x); await other.waitForTimeout(50); } })();

    await expect.poll(async () => (await admin.from('nodes').select('x').eq('id', node.id).single()).data?.x, { timeout: 10_000 }).not.toBe(120);
    await sampling;
    expect(Math.min(...xs), 'the node never jumps back to where it started').toBeGreaterThan(mid.x - 5);
    await expect(other.getByTestId('peer-moving')).toHaveCount(0, { timeout: 10_000 });
    const landed = (await peerTile.boundingBox())!;
    const mine = (await tile.boundingBox())!;
    expect(Math.abs(landed.x - mine.x)).toBeLessThan(2);
  });

  test('a committed move reaches the other tab in well under a second', async ({ page, session, seedNode, admin }) => {
    const node = await seedNode({ type: 'motion', x: 120, y: 160, data: ELEMENT });
    await admin.from('nodes').update({ width: 120, height: 120 }).eq('id', node.id);
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    const path = `/p/${session.projectId}/c/${session.canvasId}`;
    const other = await page.context().newPage();
    await gotoHydrated(page, path);
    await gotoHydrated(other, path);
    await page.waitForTimeout(1500);

    const peerTile = other.locator(`.svelte-flow__node[data-id="${node.id}"]`);
    const before = (await peerTile.boundingBox())!;
    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('ControlOrMeta+a');
    const started = Date.now();
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(async () => (await peerTile.boundingBox())!.x - before.x, { timeout: 5000, intervals: [10] }).toBeGreaterThan(0);
    const latency = Date.now() - started;
    console.log(JSON.stringify({ committedMoveLatencyMs: latency }));
    expect(latency).toBeLessThan(COMMIT_LATENCY_MS);
  });

  test('spotlight: the other person is offered to follow, and their view then tracks mine', async ({ page, browser, session }) => {
    const path = `/p/${session.projectId}/c/${session.canvasId}`;
    const elsewhere = await browser.newContext({ viewport: DESKTOP });
    const other = await elsewhere.newPage();
    await signInE2e(other, { email: session.email, password: session.password });
    await gotoHydrated(page, path);
    await gotoHydrated(other, path);

    await page.getByTestId('spotlight').click();
    await other.getByTestId('presenter-prompt').getByRole('button', { name: 'Follow' }).click();
    const viewOf = (p: typeof page) => p.locator('.svelte-flow__viewport').first().getAttribute('style');
    const before = await viewOf(other);
    const mineBefore = await viewOf(page);

    await page.mouse.move(600, 400);
    await page.mouse.wheel(300, 200);
    await expect.poll(() => viewOf(page), { timeout: 5000 }).not.toBe(mineBefore);
    await expect.poll(() => viewOf(other), { timeout: 5000 }).not.toBe(before);
    await expect(other.getByTestId('presenter-prompt')).toHaveCount(0);
    await elsewhere.close();
  });

  test('cursor chat: what I type next to my cursor shows next to it in the other tab, and goes away', async ({ page, session }) => {
    const path = `/p/${session.projectId}/c/${session.canvasId}`;
    const other = await page.context().newPage();
    await gotoHydrated(page, path);
    await gotoHydrated(other, path);
    await page.waitForTimeout(1500);

    await page.mouse.move(500, 400);
    await page.keyboard.press('/');
    await page.getByTestId('cursor-chat').fill('hello there');
    await expect(other.getByTestId('peer-chat')).toHaveText('hello there', { timeout: 5000 });

    await page.keyboard.press('Escape');
    await expect(other.getByTestId('peer-chat')).toHaveCount(0, { timeout: 5000 });
  });
});
