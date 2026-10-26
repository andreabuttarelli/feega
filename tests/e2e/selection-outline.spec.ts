import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { expectOutlined, settleLate } from './fixtures/outline';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const FRAME_DATA = {
  format: 'landscape',
  docHeadRevision: 1,
  posterAssetId: null,
  lastRenderAssetId: null
};
const DESKTOP = { width: 1280, height: 860 };
const ZOOMS = [0.5, 1, 2];
const ZOOM_TOLERANCE = 0.1;
const MAX_ZOOM_STEPS = 20;
const TEXT = 'Ana';
const SHOTS = process.env.SELECTION_OUTLINE_SHOTS;

const title = doc.tracks[0].clips[0];
const still = {
  ...doc,
  tracks: [
    {
      ...doc.tracks[0],
      clips: [
        {
          ...title,
          id: 'a',
          keyframes: {
            x: [
              { frame: 0, value: 0, ease: 'linear' },
              { frame: 89, value: 0.2, ease: 'linear' }
            ]
          },
          props: { ...title.props, text: TEXT, x: 0.3, y: 0.3, size: 0.08 }
        }
      ]
    },
    doc.tracks[1]
  ]
};

test.use({ viewport: DESKTOP });

const scaleOf = (page: Page) => page.locator('.svelte-flow__viewport').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);

async function zoomTo(page: Page, target: number) {
  await page.locator('.svelte-flow__pane').click({ position: { x: 5, y: 5 } });
  for (let i = 0; i < MAX_ZOOM_STEPS; i++) {
    const scale = await scaleOf(page);
    if (Math.abs(scale - target) / target < ZOOM_TOLERANCE) {
      return;
    }
    await page.keyboard.press(scale > target ? '-' : '+');
    await page.waitForTimeout(250);
  }
  throw new Error(`could not zoom the canvas to ${target}`);
}

const posterSaved = (page: Page) =>
  page.waitForResponse((r) => new URL(r.url()).searchParams.get('action') === 'poster', {
    timeout: 30_000
  });

async function expectFollows(page: Page, poster: Promise<unknown>, where: string) {
  const outline = page.getByTestId('selection-box');
  await expectOutlined(page, outline, TEXT, where);
  await poster;
  await expectOutlined(page, outline, TEXT, `${where}, after the poster is shot`);
  await settleLate(page, TEXT);
  await expectOutlined(page, outline, TEXT, `${where}, after the drawing settles late`);
}

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

test.describe('the selection outline sits on the element @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(90_000);

  test.beforeEach(async ({ session, admin, seedNode }, info) => {
    const node = await seedNode({
      type: 'motion',
      x: 80,
      y: 120,
      data: FRAME_DATA
    });
    expect(
      (
        await admin.from('motion_revisions').insert({
          org_id: session.orgId,
          node_id: node.id,
          version: 1,
          doc: still,
          actor_kind: 'user',
          actor_id: session.userId
        })
      ).error
    ).toBeNull();
    info.annotations.push({ type: 'node', description: node.id });
  });

  const nodeOf = (info: { annotations: { type: string; description?: string }[] }) => info.annotations.find((a) => a.type === 'node')!.description!;

  for (const zoom of ZOOMS) {
    test(`inline on the canvas at zoom ${zoom}`, async ({ page, session }, info) => {
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await zoomTo(page, zoom);
      const stage = page.locator(`.svelte-flow__node[data-id="${nodeOf(info)}"]`).getByTestId('motion-node-stage');
      await stage.click({ position: { x: 20, y: 10 } });
      const poster = posterSaved(page);
      await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
      await page.getByTestId('motion-editor').locator('[data-clip-id="a"]').first().click();

      await expectFollows(page, poster, `inline at ${zoom}`);
      await shoot(page, `inline-${zoom}-${info.project.name}`);
    });
  }
});
