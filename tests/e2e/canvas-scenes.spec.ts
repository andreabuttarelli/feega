import { homedir } from 'node:os';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const SCENE_FRAMES = 45;
const FRAME = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

const sceneDoc = (text: string, color: string) => ({
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: SCENE_FRAMES,
  background: 'brand',
  still: { frame: 0 },
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        { id: 'bg', component: 'Shape', from: 0, durationInFrames: SCENE_FRAMES, props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: [{ type: 'solid', color, opacity: 1, visible: true, blend: 'normal' }] } },
        { id: 'title', component: 'Text', from: 0, durationInFrames: SCENE_FRAMES, props: { text, size: 0.14, x: 0.5, y: 0.5, width: 0.8, height: 0.3 } }
      ]
    }
  ],
  comps: {},
  assets: []
});

type Clip = { component: string; from: number; props: { scene?: string } };
type Head = { durationInFrames: number; tracks: { clips: Clip[] }[]; comps: Record<string, unknown> };

test.describe('scenes combined into one video @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('three frames become one video that plays them in canvas order and exports one mp4', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(300_000);
    const scenes = [
      { x: 2400, text: 'three', color: '#2244ff' },
      { x: 80, text: 'one', color: '#ff3355' },
      { x: 1240, text: 'two', color: '#22aa66' }
    ];
    const ids: string[] = [];
    for (const s of scenes) {
      const frame = await seedNode({ type: 'motion', x: s.x, y: 80, data: FRAME });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: sceneDoc(s.text, s.color), actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      ids.push(frame.id);
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const hosts = ids.map((id) => page.locator(`[data-testid="frame-overlays"] [data-frame="${id}"]`));
    await expect(hosts[0]).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const boxes = await Promise.all(hosts.map(async (h) => (await h.boundingBox())!));
    const left = Math.min(...boxes.map((b) => b.x)) - 20;
    const top = Math.min(...boxes.map((b) => b.y)) - 30;
    const right = Math.max(...boxes.map((b) => b.x + b.width)) + 20;
    const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + 20;
    await page.mouse.move(left, top);
    await page.mouse.down();
    await page.mouse.move(right, bottom, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(left + 10, bottom + 40, { button: 'right' });
    await page.screenshot({ path: `${SHOTS}/seq-1-combine-menu.png` });
    await page.getByRole('menuitem', { name: 'Combine into video' }).click();

    const parent = async () => {
      const { data } = await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).eq('type', 'motion').is('deleted_at', null).not('id', 'in', `(${ids.join(',')})`);
      return data?.[0]?.id ?? null;
    };
    await expect.poll(parent, { timeout: 30_000 }).not.toBeNull();
    const parentId = (await parent())!;
    const { data: rows } = await admin.from('motion_revisions').select('doc').eq('node_id', parentId).order('version', { ascending: false }).limit(1);
    const head = rows?.[0]?.doc as Head;
    const placed = head.tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Precomp');
    expect(placed.map((c) => c.props.scene)).toEqual([ids[1], ids[2], ids[0]]);
    expect(placed.map((c) => c.from)).toEqual([0, SCENE_FRAMES, SCENE_FRAMES * 2]);
    expect(head.durationInFrames).toBe(SCENE_FRAMES * 3);
    expect(Object.keys(head.comps)).toEqual([]);

    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${parentId}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+Digit1');
    await page.waitForTimeout(SETTLE_MS * 2);
    await page.screenshot({ path: `${SHOTS}/seq-2-combined-frame.png` });

    const box = (await host.boundingBox())!;
    await expect(async () => {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/seq-3-parent-timeline.png` });
    await page.getByRole('button', { name: 'More actions' }).click();
    await page.getByRole('menuitem', { name: 'Export…' }).click();
    await page.getByTestId('export-mode-video').click();
    await page.getByTestId('export-start').click();
    const download = page.getByTestId('export-download');
    await expect(download).toBeVisible({ timeout: 240_000 });
    await page.getByTestId('export-dialog').screenshot({ path: `${SHOTS}/seq-4-exported.png` });
    const saving = page.waitForEvent('download');
    await download.click();
    await (await saving).saveAs(`${SHOTS}/seq-combined.mp4`);
  });
});
