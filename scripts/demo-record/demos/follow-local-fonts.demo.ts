import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { easeInOutExpo } from '../camera';
import { FRAME_CELL, frameHost, heroDoc, openCanvas, productCardDoc, seedFrame } from './seed';

const TEAMMATE = { id: '00000000-0000-4000-8000-0000000000b1', name: 'Bruno' };
const CANVAS_PEER_EVENT = 'canvas-peer';
const BROADCAST_MS = 33;
const PAN_STEPS = 60;
const FOLLOW_ZOOM = 1.3;
const FONT_QUERY = 'Avenir Next';
const WHEEL_PX = 160;
const SHOTS = '/private/tmp/claude-501/follow-shots';
const MORE = 'More actions';

type View = { cx: number; cy: number; zoom: number };

async function joinAsTeammate(email: string, password: string, session: { projectId: string; canvasId: string }) {
  const client = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  await client.realtime.setAuth(signed.data.session!.access_token);
  const channel: RealtimeChannel = client.channel(`canvas:${session.canvasId}`, { config: { private: true, presence: { key: TEAMMATE.id } } });
  await new Promise<void>((resolve) => channel.subscribe((status) => status === 'SUBSCRIBED' && resolve()));
  await channel.track({ userId: TEAMMATE.id, name: TEAMMATE.name, avatar: null, path: `/p/${session.projectId}/c/${session.canvasId}`, threadId: null });
  const sessionId = 'bruno-session';
  const send = (view: View) => channel.send({ type: 'broadcast', event: CANVAS_PEER_EVENT, payload: { sessionId, userId: TEAMMATE.id, name: TEAMMATE.name, cursor: { x: view.cx, y: view.cy }, selection: [], live: [], view, presenting: false, chat: null, at: Date.now() } });
  return {
    send,
    async pan(from: View, to: View) {
      for (let i = 0; i <= PAN_STEPS; i++) {
        const p = easeInOutExpo(i / PAN_STEPS);
        await send({ cx: from.cx + (to.cx - from.cx) * p, cy: from.cy + (to.cy - from.cy) * p, zoom: from.zoom + (to.zoom - from.zoom) * p });
        await new Promise((r) => setTimeout(r, BROADCAST_MS));
      }
    },
    close: () => client.removeChannel(channel)
  };
}

mkdirSync(SHOTS, { recursive: true });

test('follow a teammate and local fonts', async ({ page, context, session, admin, seedNode }) => {
  await context.grantPermissions(['local-fonts']).catch(() => {});
  const hero = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, heroDoc(60));
  await seedFrame(seedNode, admin, session, { x: 80 + FRAME_CELL.w + 400, y: 80 }, productCardDoc());
  await installCursor(page);
  await openCanvas(page, session);
  const bruno = await joinAsTeammate(session.email, session.password, session);
  const home: View = { cx: 80 + FRAME_CELL.w / 2, cy: 80 + FRAME_CELL.h / 2, zoom: 1 };
  const away: View = { cx: 80 + FRAME_CELL.w + 400 + FRAME_CELL.w / 2, cy: 80 + FRAME_CELL.h / 2, zoom: FOLLOW_ZOOM };
  const beat = setInterval(() => void bruno.send(home), BROADCAST_MS * 10);
  await expect(page.getByRole('button', { name: 'Follow Bruno' })).toBeVisible({ timeout: 30_000 });
  clearInterval(beat);

  await recordDemo(page, { slug: 'follow-local-fonts', title: 'follow a teammate, use installed fonts' }, async (d) => {
    await d.click(page.getByRole('button', { name: 'Follow Bruno' }));
    await bruno.pan(home, away);
    await d.wait(1200);
    await expect(page.getByRole('button', { name: 'Stop following Bruno' })).toBeVisible();
    await page.mouse.move(800, 450);
    await page.mouse.wheel(-WHEEL_PX, 0);
    await expect(page.getByRole('button', { name: 'Follow Bruno' })).toBeVisible();
    await d.wait(800);
    await page.keyboard.press('Shift+Digit1');
    await d.wait(1500);
    const box = (await frameHost(page, hero).boundingBox())!;
    await d.click({ x: box.x + box.width * 0.3, y: box.y + box.height * 0.5 });
    await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 15_000 });
    await d.click(page.getByTestId('frame-timeline').getByText('Mornings, made slower.', { exact: true }));
    await d.click(page.getByTestId('font-picker').getByRole('button').first());
    await d.click(page.getByTestId('font-installed-show'));
    await expect(page.getByTestId('font-installed')).toBeVisible({ timeout: 90_000 });
    await d.type(page.getByRole('searchbox', { name: 'Search fonts' }), FONT_QUERY);
    await d.click(page.getByTestId('font-installed').getByRole('button', { name: /^Avenir Next\s*local$/ }));
    await d.wait(1500);
  });
  await page.screenshot({ path: join(SHOTS, 'picked.png') });
  await page.getByRole('button', { name: MORE }).click();
  await page.getByRole('menuitem', { name: 'Export…' }).click();
  await expect(page.getByTestId('export-local-fonts')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: join(SHOTS, 'export.png') });
  await bruno.close();
});
