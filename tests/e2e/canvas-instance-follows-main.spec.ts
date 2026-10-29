import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import { createComponent } from '../../src/lib/motion/main-component';
import { homed, placeInstance } from '../../src/lib/motion/canvas-components';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/editor-modes`;
const SETTLE_MS = 2500;
const FRAME_DATA = { format: '16:9', docHeadRevision: 2, posterAssetId: null, lastRenderAssetId: null };

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

let n = 0;
const newId = () => `e2e${++n}`;
const labelled = (text: string) => must(createComponent(must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text, size: 0.12, x: 0.5, y: 0.5, width: 0.6, height: 0.25 } }, 'label')), ['label'], () => 'button', 'Button'));
const [edited, current] = [labelled('Order now'), labelled('Buy now')];
const compId = String(current.tracks[0].clips[0].props.comp);

const innerText = (doc: MotionDoc) => (doc.comps[compId].tracks[0].clips[0] as MotionClip).props.text;

test.describe('instances follow their main across canvases @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('editing the main on canvas A updates its instance on canvas B', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const home = await seedNode({ type: 'motion', x: 80, y: 80, data: FRAME_DATA });
    const otherCanvas = randomUUID();
    const { error: canvasError } = await admin.from('canvases').insert({ id: otherCanvas, org_id: session.orgId, project_id: session.projectId, name: 'Checkout' });
    expect(canvasError).toBeNull();
    const away = randomUUID();
    const carried = must(placeInstance(newMotionDoc(MotionFormat.Landscape), homed(current, home.id), compId, newId));
    const { error: nodeError } = await admin.from('nodes').insert({ id: away, org_id: session.orgId, project_id: session.projectId, canvas_id: otherCanvas, type: 'motion', x: 80, y: 80, data: { ...FRAME_DATA, docHeadRevision: 1, mainHomes: [home.id] }, actor_kind: 'user', actor_id: session.userId });
    expect(nodeError).toBeNull();
    for (const [nodeId, version, doc] of [[home.id, 1, edited], [home.id, 2, current], [away, 1, carried]] as const) {
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: nodeId, version, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${otherCanvas}`);
    await expect(page.locator(`[data-testid="frame-overlays"] [data-frame="${away}"]`)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/instance-follows-1-before.png` });

    const refetched = page.waitForRequest((r) => r.url().includes(`/motion/${away}/source`) && r.url().includes('linked='), { timeout: 30_000 });
    const anon = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const signedIn = await anon.auth.signInWithPassword({ email: session.email, password: session.password });
    const headers = { authorization: `Bearer ${signedIn.data.session!.access_token}` };
    const restored = await page.request.post(`/api/v1/motion/${home.id}/revisions`, { data: { version: 1 }, headers });
    expect(restored.ok(), await restored.text()).toBe(true);

    await refetched;
    const source = await (await page.request.get(`/p/${session.projectId}/c/${otherCanvas}/motion/${away}/source`)).json();
    expect(innerText(source.doc)).toBe('Order now');
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/instance-follows-2-after.png` });
  });
});
