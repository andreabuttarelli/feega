import { homedir } from 'node:os';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const INTER = { family: 'Inter', source: 'google', category: 'sans', weights: [400, 700], italic: false, axes: [] };

const docOf = () => ({
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  fonts: [INTER],
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        { id: 'a', component: 'Text', from: 0, durationInFrames: 150, props: { text: 'Inter here', font: 'Inter', size: 0.08, color: '#ffffff', x: 0.5, y: 0.35, width: 0.6, height: 0.2 } },
        { id: 'b', component: 'Text', from: 0, durationInFrames: 150, props: { text: 'and Inter there', font: 'Inter', size: 0.08, color: '#ffffff', x: 0.5, y: 0.65, width: 0.6, height: 0.2 } }
      ]
    }
  ],
  comps: {},
  assets: []
});

type Head = { fonts: { family: string }[]; tracks: { clips: { props: Record<string, unknown> }[] }[] };

test.describe('replace a font in the whole video @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');
  test.use({ viewport: { width: 1600, height: 1000 } });

  test('replace all swaps every clip to the picked font', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: docOf(), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await host.boundingBox())!;

    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.35);
    await page.waitForTimeout(SETTLE_MS);
    const inspector = page.getByTestId('frame-inspector');
    await inspector.getByTestId('replace-font').click();
    await inspector.getByRole('button', { name: 'Font Inter' }).click();
    await inspector.getByLabel('Search fonts').fill('Bebas Neue');
    await inspector.getByTestId('font-results').getByRole('button', { name: /Bebas Neue/ }).first().click();
    await page.waitForTimeout(SETTLE_MS * 2);
    await page.screenshot({ path: `${SHOTS}/text-font-replace.png`, clip: box });

    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    const doc = data?.[0]?.doc as Head;
    expect(doc.tracks[0].clips.map((c) => c.props.font)).toEqual(['Bebas Neue', 'Bebas Neue']);
    expect(doc.fonts.map((f) => f.family)).toEqual(['Bebas Neue']);
  });
});
