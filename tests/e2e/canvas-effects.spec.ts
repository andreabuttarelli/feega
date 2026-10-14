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

type Effect = { kind: string; enabled: boolean };
type Clip = { id: string; effects?: Effect[] };
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

function shadedDoc() {
  const back = { id: 'back', from: 0, durationInFrames: 150, component: 'Title', props: { text: 'BEHIND', y: 0.45, height: 0.3, color: '#ff5a1f' } };
  const card = {
    id: 'card',
    from: 0,
    durationInFrames: 150,
    component: 'Shape',
    effects: [{ id: 'bg', kind: 'background-blur', enabled: true, params: { radius: 16 } }],
    props: { shape: 'rect', roundness: 0.1, x: 0.5, y: 0.45, width: 0.6, height: 0.35, fills: [{ type: 'solid', color: '#ffffff', opacity: 0.25 }] }
  };
  return {
    version: 5,
    fps: 30,
    width: 1080,
    height: 1350,
    durationInFrames: 150,
    still: { frame: 90 },
    tracks: [
      { id: 'v2', kind: 'visual', name: 'Video 2', clips: [card] },
      { id: 'v1', kind: 'visual', name: 'Video 1', clips: [back] }
    ],
    comps: {},
    assets: []
  };
}

test.use({ video: SHOTS ? 'on' : 'off' });

test.describe('effects stack @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('a glass card blurs what is behind it; an inner shadow adds, and the eye hides it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: shadedDoc(), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mode', 'still', { timeout: 15_000 });

    await expect
      .poll(
        async () => {
          for (const frame of page.frames()) {
            const backdrop = await frame.evaluate(() => (document.querySelector('#ef-card') as HTMLElement | null)?.style.backdropFilter ?? null).catch(() => null);
            if (backdrop) {
              return backdrop;
            }
          }
          return null;
        },
        { timeout: 15_000 }
      )
      .toBe('blur(16px)');

    const overlay = page.getByTestId('selection-overlay');
    await expect(async () => {
      await overlay.click();
      await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 1000 });
    }, 'the card selects once the preview has measured it').toPass({ timeout: 15_000 });
    await page.getByRole('tab', { name: 'Properties' }).click();
    const inspector = page.getByTestId('motion-inspector');
    await inspector.getByTestId('add-effect').click();
    await page.getByRole('menuitem', { name: 'Inner shadow', exact: true }).dispatchEvent('click');
    await expect.poll(async () => clipOf(await head(admin, node.id), 'card')?.effects?.map((e) => e.kind), { timeout: 10_000 }).toEqual(['background-blur', 'inner-shadow']);
    await inspector.getByTestId('effect-open').last().click();
    await expect(page.getByTestId('side-popover').getByTestId('side-popover-title')).toHaveText('Inner shadow');
    await shoot(page, 'pr2-effects-stack');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('side-popover')).toHaveCount(0);

    await inspector.getByTestId('effect-eye').last().click();
    await expect.poll(async () => clipOf(await head(admin, node.id), 'card')?.effects?.[1].enabled, { timeout: 10_000 }).toBe(false);
    await shoot(page, 'pr2-effects-hidden');
  });
});
