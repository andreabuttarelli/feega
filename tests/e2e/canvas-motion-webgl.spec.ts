import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import sharp from 'sharp';
import doc from './fixtures/motion-webgl-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const LIT_LUMA = 60;
const MIN_LIT_SHARE = 0.15;
const CENTRE = 0.2;
const SHOTS = process.env.CANVAS_MOTION_SHOTS;

const QUADRANTS = [
  [0, 0],
  [0.5, 0],
  [0, 0.5],
  [0.5, 0.5]
] as const;

async function litShare(shot: Buffer): Promise<number> {
  const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let lit = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] > LIT_LUMA) {
      lit++;
    }
  }
  return lit / (data.length / info.channels);
}

async function dimmestCorner(page: Page): Promise<number> {
  const box = (await page.getByTestId('motion-preview').first().boundingBox())!;
  const shares = [];
  for (const [x, y] of QUADRANTS) {
    shares.push(await litShare(await page.screenshot({ clip: { x: box.x + box.width * x, y: box.y + box.height * y, width: box.width / 2, height: box.height / 2 } })));
  }
  return Math.min(...shares);
}

async function centreShare(page: Page): Promise<number> {
  const box = (await page.getByTestId('motion-preview').first().boundingBox())!;
  return litShare(await page.screenshot({ clip: { x: box.x + box.width * (0.5 - CENTRE / 2), y: box.y + box.height * (0.5 - CENTRE / 2), width: box.width * CENTRE, height: box.height * CENTRE } }));
}

async function expectDrawn(page: Page, name: string) {
  await expect.poll(() => dimmestCorner(page), { timeout: 20_000, message: `the whole three.js frame shows in the ${name}: a tile in every corner, not a zoomed-in crop` }).toBeGreaterThan(MIN_LIT_SHARE);
  expect(await centreShare(page), `the centre of the frame stays dark in the ${name}`).toBeLessThan(MIN_LIT_SHARE);

  if (page.context().browser()?.browserType().name() === 'webkit') {
    const zoom = await page.locator('hyperframes-player').first().evaluate((el) => (el as HTMLElement & { iframeElement: HTMLIFrameElement }).iframeElement.style.zoom);
    expect(zoom, `the ${name} scales the frame by transform on WebKit: iOS draws a zoomed iframe as a crop of the frame`).toBe('');
  }

  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name.replace(/ /g, '-')}.png` });
  }
}

test.describe('a three.js component in the motion editor @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('draws in the inline editor', async ({ page, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'motion', x: 80, y: 120, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`.svelte-flow__node[data-id="${node.id}"]`).getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    if (test.info().project.name === 'webkit-iphone') {
      await page.locator(`.svelte-flow__node[data-id="${node.id}"]`).getByTestId('motion-node-stage').dblclick({ position: { x: 60, y: 10 } });
    }
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
    await expectDrawn(page, 'inline editor');
  });
});
