import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { LAUNCH, heroDoc, launchScene, openCanvas, productCardDoc, seedFrame, solid } from './seed';

const FRAME = { w: 640, h: 360 };
const GAP = 120;
const STEP_MS = 1400;
const WATCH_MS = 3000;

type Step = { op: string; target?: string; input: Record<string, unknown> };

async function bearer(email: string, password: string): Promise<string> {
  const client = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  return signed.data.session!.access_token;
}

function agent(token: string, orgId: string, projectId: string) {
  const session = randomUUID();
  const base = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
  return async (steps: Step[]) => {
    for (const step of steps) {
      const response = await fetch(`${base}/api/v1/edit?org=${orgId}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-feega-session': session },
        body: JSON.stringify({ project_id: projectId, ...step })
      });
      expect(response.status, `${step.op}: ${await response.clone().text()}`).toBe(200);
      await new Promise((r) => setTimeout(r, STEP_MS));
    }
  };
}

const text = (target: string, clip: string, value: string): Step => ({ op: 'set_props', target, input: { clip_id: clip, props: { text: value } } });
const fill = (target: string, clip: string, colour: string): Step => ({ op: 'set_props', target, input: { clip_id: clip, props: { fills: solid(colour) } } });

test('agents work on the canvas next to you', async ({ page, session, admin, seedNode }) => {
  const at = (i: number) => ({ x: i * (FRAME.w + GAP), y: 0 });
  const hero = await seedFrame(seedNode, admin, session, at(0), heroDoc());
  const card = await seedFrame(seedNode, admin, session, at(1), productCardDoc());
  const launch = await seedFrame(seedNode, admin, session, at(2), launchScene(LAUNCH[0]));
  for (const id of [hero, card, launch]) {
    expect((await admin.from('nodes').update({ width: FRAME.w, height: FRAME.h }).eq('id', id)).error).toBeNull();
  }

  await installCursor(page);
  await openCanvas(page, session);
  const token = await bearer(session.email, session.password);
  const copywriter = agent(token, session.orgId, session.projectId);
  const merchandiser = agent(token, session.orgId, session.projectId);
  const launcher = agent(token, session.orgId, session.projectId);

  await recordDemo(page, { slug: 'agent-cursors', title: 'agents work next to you' }, async (d) => {
    await d.wait(800);
    const working = Promise.all([
      copywriter([text(hero, 'title', 'Slow mornings, made by hand.'), text(hero, 'sub', 'Stoneware glazed in Porto. Built for the second cup.'), fill(hero, 'cta', '#9a3b1f'), text(hero, 'cta-label', 'Shop the set · €44')]),
      merchandiser([text(card, 'name', 'Morning Mug II'), text(card, 'price', '€22'), text(card, 'about', 'Speckled stoneware, 350 ml. Ships in 48 hours.')]),
      launcher([text(launch, 'title', 'Meet Orbit 2'), { op: 'move_node', input: { nodeId: launch, x: at(2).x, y: FRAME.h + GAP } }, text(launch, 'body', 'Follows your day. Now 30% brighter.')])
    ]);
    await expect(page.getByTestId('agent-avatar')).toHaveCount(3, { timeout: 10_000 });
    await page.screenshot({ path: `${process.env.HOME}/Documents/feega-videos/demos/agent-cursors-parallel.png` });
    await page.getByTestId('agent-avatar').first().hover();
    await d.wait(STEP_MS);
    await page.screenshot({ path: `${process.env.HOME}/Documents/feega-videos/demos/agent-cursors-avatars.png`, clip: { x: 1000, y: 0, width: 600, height: 120 } });
    await working;
    await d.wait(WATCH_MS);
  });

  await expect(page.getByTestId('agent-avatar')).toHaveCount(0, { timeout: 15_000 });
});
