import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { FRAME_CELL, SETTLE_MS, block, frameDoc, frameHost, heroDoc, openCanvas, packGrid, productCardDoc, seedFrame, words } from './seed';

const FRAME_COUNT = 3;
const CARD_PAGE = '#ffffff';
const INK = '#1d1a16';
const SLIDE_MS = 400;
const FADE_MS = 250;

type Doc = ReturnType<typeof frameDoc>;
type Link = Record<string, unknown>;

function withLink(doc: Doc, clip: string, link: Link): Doc {
  const [track] = doc.tracks;
  return { ...doc, tracks: [{ ...track, clips: track.clips.map((c: Record<string, unknown>) => (c.id === clip ? { ...c, interactions: [link] } : c)) }] };
}

const slide = { kind: 'slide', direction: 'left', easing: 'enter', durationMs: SLIDE_MS };
const dissolve = { kind: 'dissolve', easing: 'standard', durationMs: FADE_MS };

function confirmDoc(): Doc {
  const card = frameDoc([
    block('card', { x: 0, y: 0, w: 1920, h: 1080 }, CARD_PAGE),
    words('done', 'Added to your cart', { x: 160, y: 300, w: 1600, h: 160 }, 120, INK),
    words('line', 'Morning Mug · €24 · ships in 2 days', { x: 160, y: 500, w: 1600, h: 80 }, 48, '#5b544b'),
    block('keep', { x: 160, y: 700, w: 640, h: 140 }, INK),
    words('keep-label', 'Keep shopping', { x: 200, y: 740, w: 560, h: 60 }, 44, '#ffffff')
  ]);
  return withLink(card, 'keep', { id: 'keep', trigger: { kind: 'click' }, action: { kind: 'back' }, transition: dissolve });
}

test('prototype player', async ({ page, session, admin, seedNode }) => {
  const confirm = await seedFrame(seedNode, admin, session, { x: 0, y: 0 }, confirmDoc());
  const product = await seedFrame(seedNode, admin, session, { x: 0, y: 0 }, withLink(productCardDoc() as Doc, 'buy', { id: 'buy', trigger: { kind: 'click' }, action: { kind: 'open_overlay', target: confirm }, transition: dissolve }));
  const home = await seedFrame(seedNode, admin, session, { x: 0, y: 0 }, withLink(heroDoc() as Doc, 'cta', { id: 'cta', trigger: { kind: 'click' }, action: { kind: 'navigate', target: product }, transition: slide }));
  await packGrid(admin, [home, product, confirm], FRAME_CELL, FRAME_COUNT, 200);
  await admin.from('nodes').update({ display_name: 'Home' }).eq('id', home);
  await admin.from('nodes').update({ display_name: 'Product page' }).eq('id', product);
  await admin.from('nodes').update({ display_name: 'Added to cart' }).eq('id', confirm);
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, home)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(SETTLE_MS);
  const box = (await frameHost(page, home).boundingBox())!;

  await recordDemo(page, { slug: 'prototype-player', title: 'play a prototype' }, async (d) => {
    await d.click({ x: box.x + 6, y: box.y + 6 });
    await d.key('Escape');
    await expect(page.getByTestId('flow-section')).toBeVisible({ timeout: 20_000 });
    await d.click(page.getByTestId('flow-start'));
    await d.click(page.getByTestId('flow-name'));
    await page.keyboard.press('Meta+A');
    await d.type(null, 'Checkout');
    await page.keyboard.press('Tab');
    await d.wait(800);
    await d.click(page.getByTestId('prototype-play'));
    const player = page.getByTestId('prototype-player');
    await expect(player).toBeVisible({ timeout: 15_000 });
    await d.wait(1800);
    await d.click(player.locator('[data-interaction="cta"]'));
    await d.wait(1600);
    await d.click(player.locator('[data-interaction="buy"]'));
    await d.wait(1600);
    await d.click(player.locator('[data-interaction="keep"]'));
    await d.wait(1400);
    await d.click(page.getByTestId('prototype-close'));
    await d.click(page.getByTestId('prototype-copy-link'));
    await expect(page.getByTestId('prototype-copy-link')).toHaveText('Copied', { timeout: 60_000 });
    await d.wait(1800);
  });

  await admin.storage.from('embeds').remove([home, product, confirm].map((id) => `${id}.html`));
});
