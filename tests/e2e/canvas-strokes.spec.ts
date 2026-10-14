import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const PORTRAIT = {
  format: '4:5',
  docHeadRevision: 1,
  posterAssetId: null,
  lastRenderAssetId: null
};
const SHOTS = process.env.CANVAS_MOTION_SHOTS;

type Stroke = { align?: string; visible?: boolean; sides?: number[] };
type Clip = { id: string; props: { strokes?: Stroke[] } };
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

function strokedDoc() {
  const box = {
    id: 'box',
    from: 0,
    durationInFrames: 150,
    component: 'Shape',
    props: {
      shape: 'rect',
      x: 0.5,
      y: 0.45,
      width: 0.6,
      height: 0.45,
      fills: [{ type: 'solid', color: '#1d1d1f' }],
      strokes: [
        { paint: { type: 'solid', color: '#ff5a1f' }, width: 0.02, align: 'outside' },
        { paint: { type: 'linear-gradient', angle: 0, stops: [{ color: '#ffd400', pos: 0 }, { color: '#2b2bff', pos: 1 }] }, width: 0.01, align: 'inside', dash: 0.03, gap: 0.015 }
      ]
    }
  };
  const title = {
    id: 'title',
    from: 0,
    durationInFrames: 150,
    component: 'Title',
    props: { text: 'STROKED', y: 0.85, height: 0.2, color: '#ffffff', strokes: [{ paint: { type: 'solid', color: '#ff2d55' }, width: 0.003, align: 'outside' }] }
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
    assets: []
  };
}

test.use({ video: SHOTS ? 'on' : 'off' });

test.describe('stroke stacks @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('a box with an outside and an inside stroke renders, and its stack edits persist', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({
      org_id: session.orgId,
      node_id: node.id,
      version: 1,
      doc: strokedDoc(),
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
                return svg ? [!!svg.querySelector('mask'), !!svg.querySelector('clipPath')] : null;
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
      .toEqual([true, true]);

    const overlay = page.getByTestId('selection-overlay');
    await expect(async () => {
      await overlay.click({ position: { x: 200, y: 200 } });
      await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 1000 });
    }, 'the box selects once the preview has measured it').toPass({ timeout: 15_000 });

    await page.getByRole('tab', { name: 'Properties' }).click();
    const stack = page.getByTestId('motion-inspector').getByTestId('stroke-stack').first();
    await expect(stack.getByTestId('stroke-row')).toHaveCount(2);
    await stack.getByTestId('stroke-row').first().click();
    await expect(stack.getByTestId('stroke-editor')).toBeVisible();
    await shoot(page, 'pr2-stroke-stack');

    await stack.getByTestId('stroke-align').selectOption('center');
    await expect.poll(async () => clipOf(await head(admin, node.id), 'box')?.props.strokes?.[1].align, { timeout: 10_000 }).toBe('center');

    await stack.getByTestId('stroke-sides').click();
    await expect.poll(async () => clipOf(await head(admin, node.id), 'box')?.props.strokes?.[1].sides?.length, { timeout: 10_000 }).toBe(4);

    await stack.getByTestId('stroke-row').last().getByTestId('stroke-eye').click();
    await expect.poll(async () => clipOf(await head(admin, node.id), 'box')?.props.strokes?.[0].visible, { timeout: 10_000 }).toBe(false);

    await stack.getByTestId('stroke-add').click();
    await expect.poll(async () => clipOf(await head(admin, node.id), 'box')?.props.strokes?.length, { timeout: 10_000 }).toBe(3);
    await shoot(page, 'pr2-stroke-stack-edited');
  });
});
