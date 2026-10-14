import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';

const LANDSCAPE = { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.AUTO_LAYOUT_SHOTS;
const VIEWPORT = { width: 1440, height: 900 };

type Clip = { id: string; component: string; parent: string | null; autoLayout?: { gap: number; order: string[] } | null; layoutItem?: { width: string } };

async function latestClips(admin: SupabaseClient, nodeId: string): Promise<Clip[]> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const doc = data?.[0]?.doc as { tracks: { clips: Clip[] }[] } | undefined;
  return doc?.tracks.flatMap((t) => t.clips) ?? [];
}

async function addElement(page: Page, label: string) {
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('menuitem', { name: label, exact: true }).dispatchEvent('click');
}

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

test.describe('auto layout in the frame editor @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.describe.configure({ mode: 'serial' });

  test('⇧A wraps the selection, Properties sets the gap, both are saved', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(VIEWPORT);
    const node = await seedNode({ type: 'motion', data: LANDSCAPE });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);
    await page.getByRole('tab', { name: 'Properties' }).click();

    await addElement(page, 'Kicker');
    await addElement(page, 'Kicker');
    await page.getByTestId('timeline').click({ position: { x: 4, y: 4 }, timeout: 3000 }).catch(() => undefined);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Shift+A');

    await expect
      .poll(async () => (await latestClips(admin, node.id)).filter((c) => c.parent && (c.component === 'Kicker')).length, { timeout: 15_000 })
      .toBe(2);
    const container = (await latestClips(admin, node.id)).find((c) => c.autoLayout)!;
    expect(container.autoLayout!.order).toHaveLength(2);

    const section = page.getByTestId('auto-layout-section');
    await expect(section).toBeVisible();
    await shoot(page, 'editor-wrapped');

    const gap = section.getByTestId('auto-layout-gap');
    await gap.fill('48');
    await gap.press('Enter');
    await gap.blur();
    await expect.poll(async () => (await latestClips(admin, node.id)).find((c) => c.id === container.id)?.autoLayout?.gap, { timeout: 10_000 }).toBe(48);
    await expect(page.getByTestId('auto-layout-overlay')).toBeVisible();
    await shoot(page, 'editor-gap');
    if (SHOTS) {
      await section.scrollIntoViewIfNeeded();
      await section.screenshot({ path: `${SHOTS}/properties-section.png` });
    }
  });
});
