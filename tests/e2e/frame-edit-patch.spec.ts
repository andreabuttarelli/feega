import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const DESKTOP = { width: 1440, height: 900 };
const ECHO_SETTLE_MS = 5_000;
const LINE = 'poster#lines:1';
const RELOADING = /[?&]action=(snapshot|head)(&|$)/;

type PosterDoc = { tracks: { clips: { id: string; props: { lines?: string } }[] }[] };

const headDoc = async (admin: SupabaseClient, nodeId: string) =>
  (await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1)).data?.[0]?.doc as PosterDoc | undefined;

const clipOf = (doc: PosterDoc | undefined) => doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === 'poster');

type Probe = { stageReloads: number; rowsKept: number; rows: number; nodeKept: boolean };

async function arm(page: Page, nodeId: string) {
  await page.evaluate((id) => {
    const stage = document.querySelector('[data-testid=motion-preview] hyperframes-player');
    const probe = { stage, reloads: 0, rows: [...document.querySelectorAll('[data-testid=layers] [data-layer]')], node: document.querySelector(`.svelte-flow__node[data-id="${id}"] [data-testid=motion-node]`) };
    (window as unknown as { __edit: typeof probe }).__edit = probe;
    const set = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name: string, value: string) {
      if (name === 'srcdoc' && this === probe.stage) {
        probe.reloads++;
      }
      return set.call(this, name, value);
    };
  }, nodeId);
}

function read(page: Page, nodeId: string): Promise<Probe> {
  return page.evaluate((id) => {
    const probe = (window as unknown as { __edit: { stage: Element | null; reloads: number; rows: Element[]; node: Element | null } }).__edit;
    const now = [...document.querySelectorAll('[data-testid=layers] [data-layer]')];
    const node = document.querySelector(`.svelte-flow__node[data-id="${id}"] [data-testid=motion-node]`);
    return { stageReloads: probe.reloads, rowsKept: probe.rows.filter((r) => now.includes(r)).length, rows: probe.rows.length, nodeKept: node === probe.node && node !== null };
  }, nodeId);
}

async function editLine(page: Page, text: string) {
  const field = page.getByTestId('part-text');
  await field.fill(text);
  await field.press('Enter');
}

test.describe('a frame edit patches, it does not reload @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.use({ viewport: DESKTOP });

  test('text edits keep the Layers rows, the stage player and the canvas node; no canvas resync', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 120, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    await layers.locator(`[data-layer="${node.id}"]`).click();
    await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });
    await page.getByTestId('side-tab-properties').dispatchEvent('click');
    await layers.locator(`[data-layer="${LINE}"]`).click();
    await expect(page.getByTestId('part-text')).toHaveValue('NAME', { timeout: 15_000 });

    await arm(page, node.id);
    const resyncs: string[] = [];
    page.on('request', (req) => {
      if (RELOADING.test(req.url())) {
        resyncs.push(req.url());
      }
    });

    const savedText = async () => clipOf(await headDoc(admin, node.id))?.props.lines;
    await editLine(page, 'HELLO');
    await expect.poll(savedText, { timeout: 10_000 }).toContain('HELLO');
    await editLine(page, 'HELLO AGAIN');
    await expect.poll(savedText, { timeout: 10_000 }).toContain('HELLO AGAIN');
    await page.waitForTimeout(ECHO_SETTLE_MS);

    const probe = await read(page, node.id);
    expect(probe.rows, 'the Layers tree was there to compare').toBeGreaterThan(1);
    expect(probe.rowsKept, 'the Layers rows are the same DOM nodes').toBe(probe.rows);
    expect(probe.nodeKept, 'the canvas node is the same DOM node').toBe(true);
    expect(probe.stageReloads, 'the stage player is patched, never reloaded').toBe(0);
    expect(resyncs, 'our own save echo does not resync the canvas or re-read the head').toEqual([]);
  });
});
