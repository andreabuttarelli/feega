import { homedir } from 'node:os';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { JunctionKind } from '../../src/lib/motion/junction-model';
import { newMotionDoc, MotionFormat } from '../../src/lib/motion/doc';
import { sceneTransition, sequenceScenes } from '../../src/lib/motion/scenes';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const SCENE_FRAMES = 45;
const FADE_FRAMES = 20;
const FRAME = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const DROP_AT_X = 0.4;
const LABEL_OFFSET = { x: 8, y: 4 };

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
type Head = { tracks: { clips: Clip[] }[] };

test.describe('scene sequence follow-ups @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('crossfade, drop-to-insert, mp4, gif and lottie of a three-scene sequence', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(480_000);
    const scenes = [
      { x: 80, text: 'one', color: '#ff3355' },
      { x: 1240, text: 'two', color: '#22aa66' },
      { x: 2400, text: 'three', color: '#2244ff' },
      { x: 3560, text: 'extra', color: '#ffaa00' }
    ];
    const ids: string[] = [];
    for (const s of scenes) {
      const frame = await seedNode({ type: 'motion', x: s.x, y: 80, data: FRAME });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: sceneDoc(s.text, s.color), actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      ids.push(frame.id);
    }

    const sequence = sequenceScenes(newMotionDoc(MotionFormat.Landscape), ids.slice(0, 3).map((nodeId) => ({ nodeId, durationInFrames: SCENE_FRAMES })));
    const second = sequence.tracks.flatMap((t) => t.clips).find((c) => c.from === SCENE_FRAMES)!;
    const withFade = sceneTransition(sequence, second.id, { kind: JunctionKind.Crossfade, durationInFrames: FADE_FRAMES });
    if (!withFade.ok) {
      throw new Error(withFade.error);
    }
    const parent = await seedNode({ type: 'motion', x: 1240, y: 900, data: FRAME });
    const written = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: parent.id, version: 1, doc: withFade.doc, actor_kind: 'user', actor_id: session.userId });
    expect(written.error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const hostOf = (id: string) => page.locator(`[data-testid="frame-overlays"] [data-frame="${id}"]`);
    await expect(hostOf(parent.id)).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Shift+Digit1');
    await page.waitForTimeout(SETTLE_MS * 2);
    await page.screenshot({ path: `${SHOTS}/seq2-1-canvas.png` });

    const order = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', parent.id).order('version', { ascending: false }).limit(1);
      return (data?.[0]?.doc as Head).tracks.flatMap((t) => t.clips).filter((c) => c.component === 'Precomp').map((c) => c.props.scene);
    };
    const extra = (await hostOf(ids[3]).boundingBox())!;
    const target = (await hostOf(parent.id).boundingBox())!;
    await page.mouse.move(extra.x + LABEL_OFFSET.x, extra.y - LABEL_OFFSET.y);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width * DROP_AT_X, target.y + target.height / 2, { steps: 20 });
    await page.screenshot({ path: `${SHOTS}/seq2-2-dragging.png` });
    await page.mouse.up();
    await expect.poll(order, { timeout: 30_000 }).toEqual([ids[0], ids[3], ids[1], ids[2]]);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/seq2-3-dropped.png` });

    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+Digit1');
    await page.waitForTimeout(SETTLE_MS);
    const box = (await hostOf(parent.id).boundingBox())!;
    await expect(async () => {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 25_000 });
    await page.waitForTimeout(SETTLE_MS);
    await page.getByRole('tab', { name: 'Properties', exact: true }).click();
    await expect(page.getByTestId('scene-row')).toHaveCount(4);
    await page.screenshot({ path: `${SHOTS}/seq2-4-timeline.png` });

    for (const [format, file] of [['MP4', 'seq2-combined.mp4'], ['GIF', 'seq2-combined.gif']]) {
      await page.getByRole('button', { name: 'More actions' }).click();
      await page.getByRole('menuitem', { name: 'Export…' }).click();
      await page.getByTestId('export-mode-video').click();
      await page.getByTestId('export-format').getByRole('radio', { name: format, exact: true }).click();
      await page.getByTestId('export-start').click();
      const download = page.getByTestId('export-download');
      await expect(download).toBeVisible({ timeout: 240_000 });
      const saving = page.waitForEvent('download');
      await download.click();
      await (await saving).saveAs(`${SHOTS}/${file}`);
      await page.keyboard.press('Escape');
    }

    const lottie = await page.evaluate(async ({ canvasUrl, frameId }) => {
      const form = new FormData();
      form.set('frame_ids', JSON.stringify([frameId]));
      form.set('rows', JSON.stringify([{ format: 'lottie', by: 'scale', value: 1, suffix: '', transparent: false }]));
      form.set('name', 'seq2');
      const res = await fetch(`${canvasUrl}?/exportSelection`, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
      return await res.text();
    }, { canvasUrl: `/p/${session.projectId}/c/${session.canvasId}`, frameId: parent.id });
    console.log('lottie export answer', lottie.slice(0, 600));
    expect(lottie).toContain('"success"');
  });
});
