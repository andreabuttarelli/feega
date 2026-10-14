import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };

const PORTRAIT = {
  format: '4:5',
  docHeadRevision: 1,
  posterAssetId: null,
  lastRenderAssetId: null
};
const PICTURE = readFileSync('logo.jpg');
const SHOTS = process.env.CANVAS_MOTION_SHOTS;

type Fill = { type: string; assetId?: string; visible?: boolean };
type Clip = {
  id: string;
  props: { fills?: Fill[]; media?: { assetId: string; fills?: Fill[] }[] };
};
type Doc = { tracks: { clips: Clip[] }[] };

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

async function head(admin: SupabaseClient, nodeId: string): Promise<Doc | null> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  return (data?.[0]?.doc as Doc | undefined) ?? null;
}

const clipOf = (doc: Doc | null, id: string) => doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === id);

async function picture(admin: SupabaseClient, session: { orgId: string; projectId: string }) {
  const path = `${session.orgId}/${session.projectId}/e2e/${randomUUID()}.jpg`;
  await admin.storage.from('canvas-assets').upload(path, PICTURE, { contentType: 'image/jpeg' });
  const { data, error } = await admin
    .from('assets')
    .insert({
      org_id: session.orgId,
      project_id: session.projectId,
      type: 'image',
      url: path,
      mime_type: 'image/jpeg',
      bytes: PICTURE.length,
      width: 512,
      height: 512,
      source: 'upload'
    })
    .select('id')
    .single();
  expect(error).toBeNull();
  return data!.id as string;
}

function boxDoc(assetId: string) {
  const fills = [
    {
      type: 'linear-gradient',
      angle: 45,
      stops: [
        { color: '#ff5a1f', pos: 0 },
        { color: '#2b2bff', pos: 1 }
      ]
    },
    {
      type: 'image',
      assetId,
      fit: 'cover',
      focus: { x: 0.5, y: 0.5 },
      opacity: 0.7,
      blend: 'luminosity'
    },
    { type: 'solid', color: '#000000', opacity: 0.25 }
  ];
  const box = {
    id: 'box',
    from: 0,
    durationInFrames: 150,
    component: 'Shape',
    props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.7, height: 0.6, fills }
  };
  const title = {
    id: 'title',
    from: 0,
    durationInFrames: 150,
    component: 'Title',
    props: { text: 'FILLED\nTYPE', y: 0.85, height: 0.25, fills: [{ type: 'linear-gradient', angle: 0, stops: [{ color: '#ffd400', pos: 0 }, { color: '#ff2d55', pos: 1 }] }, { type: 'image', assetId, fit: 'cover', opacity: 0.5, blend: 'multiply' }] }
  };
  return {
    version: 5,
    fps: 30,
    width: 1080,
    height: 1350,
    durationInFrames: 150,
    still: { frame: 90 },
    tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [box, title] }],
    comps: {},
    assets: [{ id: assetId, kind: 'image' }]
  };
}

test.use({ video: SHOTS ? 'on' : 'off' });

test.describe('fill stacks @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('a box with gradient, picture and overlay renders, and its stack edits persist', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const assetId = await picture(admin, session);
    const node = await seedNode({
      type: 'motion',
      x: 80,
      y: 80,
      data: PORTRAIT
    });
    const { error } = await admin.from('motion_revisions').insert({
      org_id: session.orgId,
      node_id: node.id,
      version: 1,
      doc: boxDoc(assetId),
      actor_kind: 'user',
      actor_id: session.userId
    });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mode', 'still', { timeout: 15_000 });

    await expect
      .poll(
        async () => {
          for (const frame of page.frames()) {
            const drawn = await frame
              .evaluate(() => {
                const svg = document.querySelector('#sv-box');
                return svg ? [!!svg.querySelector('linearGradient'), !!svg.querySelector('img.fl-image'), svg.querySelectorAll('g[style*="fill:#000000"]').length] : null;
              })
              .catch(() => null);
            if (drawn) {
              return drawn;
            }
          }
          return null;
        },
        { timeout: 15_000 }
      )
      .toEqual([true, true, 1]);

    const overlay = page.getByTestId('selection-overlay');
    await expect(async () => {
      await overlay.click();
      await expect(page.getByTestId('selection-box')).toBeVisible({
        timeout: 1000
      });
    }, 'the box selects once the preview has measured it').toPass({
      timeout: 15_000
    });

    await page.getByRole('tab', { name: 'Properties' }).click();
    const stack = page.getByTestId('motion-inspector').getByTestId('fill-stack').first();
    await expect(stack.getByTestId('fill-row')).toHaveCount(3);
    await stack.getByTestId('fill-row').nth(1).getByTestId('fill-swatch').click();
    await expect(stack.getByTestId('fill-editor')).toBeVisible();
    const popover = page.getByTestId('side-popover');
    await expect(popover.getByTestId('side-popover-title')).toHaveText('Image');
    const [panel, side, row] = await Promise.all([page.getByTestId('motion-inspector').boundingBox(), popover.boundingBox(), stack.getByTestId('fill-row').nth(1).boundingBox()]);
    expect(side!.x + side!.width).toBeLessThanOrEqual(panel!.x);
    const clamped = Math.min(row!.y, page.viewportSize()!.height - 8 - side!.height);
    expect(Math.abs(side!.y - Math.max(8, clamped))).toBeLessThan(2);
    await shoot(page, 'box-fill-stack');
    await shoot(page, 'clarity-after');

    await stack.getByTestId('fill-row').first().getByTestId('fill-eye').click();
    await expect.poll(async () => clipOf(await head(admin, node.id), 'box')?.props.fills?.[2].visible, { timeout: 10_000 }).toBe(false);

    const fillHead = page.getByTestId('motion-inspector').locator('[data-section="fill"]');
    await fillHead.getByTestId('fill-add').click();
    await shoot(page, 'fill-add-menu');
    await page.getByRole('menuitem', { name: 'Solid', exact: true }).dispatchEvent('click');
    await expect.poll(async () => clipOf(await head(admin, node.id), 'box')?.props.fills?.map((f) => f.type), { timeout: 10_000 }).toEqual(['linear-gradient', 'image', 'solid', 'solid']);
  });

  test('a poster photo is a box with an image fill: replace its picture, add an overlay', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const assetId = await picture(admin, session);
    const node = await seedNode({
      type: 'motion',
      x: 80,
      y: 80,
      data: PORTRAIT
    });
    const { error } = await admin.from('motion_revisions').insert({
      org_id: session.orgId,
      node_id: node.id,
      version: 1,
      doc: poster,
      actor_kind: 'user',
      actor_id: session.userId
    });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mode', 'still', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    await page.getByTestId('layers').locator('[data-layer="poster#photos:0"]').click({ timeout: 15_000 });

    const photo = page.getByTestId('part-photo');
    await photo.getByTestId('fill-add').click();
    await photo.getByTestId('fill-add-image').click();
    await photo.getByTestId('fill-swatch').first().click();
    await photo.getByTestId('fill-asset').first().click();
    await expect.poll(async () => clipOf(await head(admin, node.id), 'poster')?.props.media?.[0], { timeout: 10_000 }).toMatchObject({ assetId, fills: [{ type: 'image', assetId }] });

    await photo.getByTestId('fill-add').click();
    await photo.getByTestId('fill-add-solid').click();
    await photo.getByTestId('fill-row').first().getByTestId('fill-opacity').fill('40');
    await photo.getByTestId('fill-row').first().getByTestId('fill-opacity').press('Enter');
    await expect.poll(async () => clipOf(await head(admin, node.id), 'poster')?.props.media?.[0].fills?.map((f) => f.type), { timeout: 10_000 }).toEqual(['image', 'solid']);
    await shoot(page, 'poster-photo-fills');
  });
});
