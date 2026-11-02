import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, gotoHydrated } from './fixtures/session';

const REAL_STACK = process.env.E2E_REAL_STACK === '1';
const SITE = process.env.GO_MAIN_SITE ?? 'https://vercel.com';
const IMPORT_MS = 300_000;
const UI_MS = 60_000;

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

type Clip = { id: string; name?: string; component: string; props: { comp?: string } };
type Doc = { tracks: { clips: Clip[] }[]; comps: Record<string, { component?: { name: string; home?: string } }> };

async function headOf(admin: SupabaseClient, nodeId: string): Promise<Doc> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1).single();
  return data!.doc as Doc;
}

test('go to main from an imported instance lands on the Components page with the main selected', async ({ page, session, admin }) => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(IMPORT_MS + 4 * UI_MS);

  await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
  const answer = await page.request.post(`/api/v1/projects/${session.projectId}/url-import`, { data: { canvasId: session.canvasId, url: SITE, x: 0, y: 0 }, timeout: IMPORT_MS });
  expect(answer.ok()).toBe(true);
  const frameId = ((await answer.json()) as { nodes: { id: string }[] }).nodes[0].id;
  const doc = await headOf(admin, frameId);
  const instance = doc.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Precomp' && doc.comps[String(c.props.comp)]?.component?.home)!;
  const compId = String(instance.props.comp);
  const home = doc.comps[compId].component!.home!;
  const { data: homeNode } = await admin.from('nodes').select('canvas_id').eq('id', home).single();
  expect((await headOf(admin, home)).tracks.flatMap((t) => t.clips).some((c) => c.props.comp === compId)).toBe(true);

  await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}?frame=${frameId}`);
  await page.getByRole('button', { name: 'Layers', exact: true }).click();
  await page.getByTestId('layers-search-toggle').click({ timeout: UI_MS });
  await page.getByTestId('layers-search').fill(instance.name ?? '', { timeout: UI_MS });
  await page.locator(`[data-testid="layers"] [data-layer="${instance.id}"]`).first().click({ timeout: UI_MS });
  await page.getByTestId('instance-go-main').click({ timeout: UI_MS });

  await expect(page).toHaveURL(new RegExp(`/c/${homeNode!.canvas_id}`), { timeout: UI_MS });
  await expect(page.locator(`[data-testid="layers"] [data-layer="${home}"][aria-selected="true"]`)).toBeAttached({ timeout: UI_MS });
});
