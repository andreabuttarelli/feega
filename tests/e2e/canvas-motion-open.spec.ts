import { randomUUID } from 'node:crypto';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';
import sharp from 'sharp';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const PHONE = { width: 390, height: 844 };
const POSTER_GREY = 200;
const BLACK_LUMA = 5;
const MAX_BLACK_SHARE = 0.5;
const SAMPLE_MS = 80;
const AFTER_SHOWN_MS = 800;
const OPEN_TIMEOUT_MS = 20_000;
const NEIGHBOUR_MIN_OPACITY = 0.75;
const BOX_TOLERANCE_PX = 2;
const DRAG_PX = 60;
const SHOTS = process.env.CANVAS_MOTION_SHOTS;

const landscape = (posterAssetId: string | null) => ({ format: '16:9', docHeadRevision: 1, posterAssetId, lastRenderAssetId: null });

async function blackShare(shot: Buffer): Promise<number> {
  const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let black = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] < BLACK_LUMA) {
      black++;
    }
  }
  return black / (data.length / info.channels);
}

async function seedFrames(page: Page, { session, admin, seedNode }: { session: { orgId: string; userId: string }; admin: import('@supabase/supabase-js').SupabaseClient; seedNode: (s: { type: string; x: number; y: number; data: Record<string, unknown> }) => Promise<{ id: string }> }) {
  const poster = randomUUID();
  const png = await sharp({ create: { width: 480, height: 270, channels: 3, background: { r: POSTER_GREY, g: POSTER_GREY, b: POSTER_GREY } } }).png().toBuffer();
  await page.route(`**/assets/${poster}**`, (route) => route.fulfill({ status: 200, contentType: 'image/png', body: png }));

  const frame = await seedNode({ type: 'motion', x: 20, y: 120, data: landscape(poster) });
  const neighbour = await seedNode({ type: 'motion', x: 20, y: 420, data: landscape(poster) });
  for (const node of [frame, neighbour]) {
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
  }
  return { frame, neighbour };
}

const nodeOf = (page: Page, id: string) => page.locator(`.svelte-flow__node[data-id="${id}"]`);

async function press(page: Page, target: Locator) {
  if (test.info().project.use.hasTouch) {
    await target.tap();
    return;
  }
  await target.click();
}

async function samplesWhileOpening(page: Page, body: Locator): Promise<number[]> {
  const shares: number[] = [];
  const stage = page.getByTestId('editor-stage');
  let shownAt: number | null = null;
  const start = Date.now();
  while (Date.now() - start < OPEN_TIMEOUT_MS) {
    const box = await body.boundingBox();
    if (box) {
      shares.push(await blackShare(await page.screenshot({ clip: box })));
    }
    const shown = (await stage.count()) > 0 && (await stage.getAttribute('data-shown')) === 'true';
    if (shown && shownAt === null) {
      shownAt = Date.now();
    }
    if (shownAt !== null && Date.now() - shownAt > AFTER_SHOWN_MS) {
      break;
    }
    await page.waitForTimeout(SAMPLE_MS);
  }
  expect(shownAt, 'the editor player drew its first frame').not.toBeNull();
  return shares;
}

test.describe('opening a frame on a phone @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(90_000);

  test('a tap selects and drags the frame; Open editor opens it with no black gap and the canvas around it', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize(PHONE);
    const { frame, neighbour } = await seedFrames(page, { session, admin, seedNode });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    const node = nodeOf(page, frame.id);
    const body = node.getByTestId('motion-node-stage');
    await expect(node.locator('img.poster')).toBeVisible();

    await press(page, body);
    await expect(node, 'a tap selects the frame').toHaveClass(/selected/);
    await page.waitForTimeout(600);
    await expect(page.getByTestId('motion-editor'), 'a tap on a phone does not open the editor').toHaveCount(0);

    const before = (await body.boundingBox())!;
    await page.mouse.move(before.x + 40, before.y + 40);
    await page.mouse.down();
    await page.mouse.move(before.x + 40 + DRAG_PX / 2, before.y + 40, { steps: 4 });
    await page.mouse.move(before.x + 40 + DRAG_PX, before.y + 40, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => (await body.boundingBox())!.x - before.x, { message: 'the frame moves under the finger' }).toBeGreaterThan(DRAG_PX / 2);
    await expect
      .poll(async () => ((await admin.from('nodes').select('x').eq('id', frame.id).single()).data?.x as number) ?? 20, { timeout: 10_000, message: 'the move is saved' })
      .toBeGreaterThan(20);

    await press(page, node.getByTestId('open-motion-editor'));
    const shares = await samplesWhileOpening(page, body);
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-open.png` });
    }
    console.log('black share while opening', shares.map((s) => s.toFixed(2)).join(' '));
    expect(Math.max(...shares), `the node is never black while the editor opens: ${shares.map((s) => s.toFixed(2)).join(' ')}`).toBeLessThan(MAX_BLACK_SHARE);
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas');

    const opacity = await nodeOf(page, neighbour.id).evaluate((n) => Number(getComputedStyle(n).opacity));
    expect(opacity, 'the other frames stay on the canvas').toBeGreaterThanOrEqual(NEIGHBOUR_MIN_OPACITY);
    await expect(nodeOf(page, neighbour.id).locator('.node-label'), 'only their labels go, which clipped at the edge').toHaveCSS('opacity', '0');

    await expect
      .poll(
        async () => {
          const [n, picture] = [await node.boundingBox(), await page.getByTestId('editor-stage').getByTestId('motion-preview').boundingBox()];
          return n && picture ? Math.max(Math.abs(n.height - picture.height), Math.abs(n.width - picture.width)) : Infinity;
        },
        { timeout: 10_000, message: 'while edited the node is only the picture: no bar under it' }
      )
      .toBeLessThan(BOX_TOLERANCE_PX * 2);
    expect((await node.getByTestId('motion-node').innerText()).trim(), 'no text inside the edited node').toBe('');
  });
});
