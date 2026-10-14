import { randomUUID } from 'node:crypto';
import type { Browser, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated, signInE2e, type E2eSession } from './fixtures/session';
import { expectOutlined, settleLate } from './fixtures/outline';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const DESKTOP = { width: 1280, height: 860 };
const FRAME_DATA = { format: 'landscape', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const VIDEO_DIR = process.env.FRAME_COLLAB_VIDEO;
const CONFLICT_NOTICE = 'Reloaded the latest version';

type Clip = (typeof doc.tracks)[number]['clips'][number];

const title = doc.tracks[0].clips[0] as Clip;
const twoTitles = {
  ...doc,
  tracks: [{ ...doc.tracks[0], clips: [{ ...title, id: 'a', props: { ...title.props, text: 'Ana', y: 0.3 } }, { ...title, id: 'b', props: { ...title.props, text: 'Bo', y: 0.7 } }] }, doc.tracks[1]]
};

test.use({ viewport: DESKTOP, actionTimeout: 15_000, ...(VIDEO_DIR ? { video: { mode: 'on', size: DESKTOP } } : {}) });

async function teammate(admin: SupabaseClient, session: E2eSession) {
  const email = `e2e-mate-${randomUUID()}@feega.app`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const userId = created.data.user!.id;
  await admin.from('profiles').upsert({ id: userId, email, name: 'Bo', onboarding_seen_at: new Date().toISOString() });
  await admin.from('orgs_members').insert({ org_id: session.orgId, user_id: userId, role: 'member' });
  return { userId, email, password };
}

async function secondPage(browser: Browser, mate: { email: string; password: string }) {
  const context = await browser.newContext({ viewport: DESKTOP, ...(VIDEO_DIR ? { recordVideo: { dir: VIDEO_DIR, size: DESKTOP } } : {}) });
  const page = await context.newPage();
  await signInE2e(page, mate);
  return page;
}

async function opacityOf(page: Page, clipId: string) {
  await page.locator(`[data-clip-id="${clipId}"]`).first().click();
  await page.getByRole('tab', { name: 'Properties', exact: true }).click();
  const field = page.locator('input.num[aria-label="Opacity"]').first();
  if (!(await field.isVisible())) {
    await page.locator('[data-section="layout"] .section-head').first().click();
  }
  return field;
}

async function setOpacity(page: Page, clipId: string, value: string) {
  const field = await opacityOf(page, clipId);
  await field.fill(value);
  await field.press('Enter');
}

const headOf = async (admin: SupabaseClient, nodeId: string) =>
  ((await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1)).data?.[0]?.doc as typeof twoTitles | undefined) ?? twoTitles;

const opacityIn = (head: typeof twoTitles, clipId: string) => {
  const clip = head.tracks[0].clips.find((c) => c.id === clipId) as (Clip & { transform?: { opacity?: number } }) | undefined;
  return clip?.transform?.opacity ?? 1;
};

test.describe('two people in one frame @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test('edits on different elements both land, and the same field converges', async ({ page, browser, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: FRAME_DATA });
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: twoTitles, actor_kind: 'user', actor_id: session.userId })).error).toBeNull();
    const mate = await teammate(admin, session);
    const path = `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`;

    try {
      const bo = await secondPage(browser, mate);
      await gotoHydrated(page, path);
      await gotoHydrated(bo, path);

      await Promise.all([setOpacity(page, 'a', '40'), setOpacity(bo, 'b', '60')]);

      await expect.poll(async () => {
        const head = await headOf(admin, node.id);
        return [opacityIn(head, 'a'), opacityIn(head, 'b')];
      }, { timeout: 20_000 }).toEqual([0.4, 0.6]);
      await expect(await opacityOf(page, 'b')).toHaveValue(/^60/, { timeout: 15_000 });
      await expect(await opacityOf(bo, 'a')).toHaveValue(/^40/, { timeout: 15_000 });

      await setOpacity(page, 'a', '20');
      await setOpacity(bo, 'a', '80');

      await expect.poll(async () => opacityIn(await headOf(admin, node.id), 'a'), { timeout: 20_000 }).toBe(0.8);
      await expect(await opacityOf(page, 'a')).toHaveValue(/^80/, { timeout: 15_000 });
      await expect(await opacityOf(bo, 'a')).toHaveValue(/^80/);

      await expect(page.getByText(CONFLICT_NOTICE)).toHaveCount(0);
      await expect(bo.getByText(CONFLICT_NOTICE)).toHaveCount(0);
      await bo.context().close();
    } finally {
      await admin.auth.admin.deleteUser(mate.userId);
    }
  });

  test('an agent edit shows up live in an open editor, on top of what the person saved', async ({ page, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: FRAME_DATA });
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: twoTitles, actor_kind: 'user', actor_id: session.userId })).error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

    await setOpacity(page, 'a', '40');
    await expect.poll(async () => opacityIn(await headOf(admin, node.id), 'a'), { timeout: 20_000 }).toBe(0.4);

    const { data } = await admin.from('motion_revisions').select('version, doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
    const head = data![0] as { version: number; doc: typeof twoTitles };
    const byAgent = { ...head.doc, tracks: [{ ...head.doc.tracks[0], clips: head.doc.tracks[0].clips.map((c) => (c.id === 'b' ? { ...c, props: { ...c.props, text: 'Agent' } } : c)) }, head.doc.tracks[1]] };
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: head.version + 1, doc: byAgent, actor_kind: 'agent', actor_id: session.userId, agent_key: 'mcp' })).error).toBeNull();
    await admin.from('nodes').update({ data: { ...FRAME_DATA, docHeadRevision: head.version + 1 } }).eq('id', node.id);

    await expect(page.frameLocator('iframe').first().getByText('Agent', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(await opacityOf(page, 'a')).toHaveValue(/^40/);
    await expect(page.getByText(CONFLICT_NOTICE)).toHaveCount(0);
  });

  test('undo takes back my edit only, never the other person’s', async ({ page, browser, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: FRAME_DATA });
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: twoTitles, actor_kind: 'user', actor_id: session.userId })).error).toBeNull();
    const mate = await teammate(admin, session);
    const path = `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`;

    try {
      const bo = await secondPage(browser, mate);
      await gotoHydrated(page, path);
      await gotoHydrated(bo, path);

      await setOpacity(page, 'a', '40');
      await expect.poll(async () => opacityIn(await headOf(admin, node.id), 'a'), { timeout: 20_000 }).toBe(0.4);
      await setOpacity(bo, 'b', '60');
      await expect(await opacityOf(page, 'b')).toHaveValue(/^60/, { timeout: 15_000 });

      await page.getByRole('button', { name: 'Undo', exact: true }).click();

      await expect.poll(async () => {
        const head = await headOf(admin, node.id);
        return [opacityIn(head, 'a'), opacityIn(head, 'b')];
      }, { timeout: 20_000 }).toEqual([1, 0.6]);
      await expect(await opacityOf(bo, 'a')).toHaveValue(/^100/, { timeout: 15_000 });
      await bo.context().close();
    } finally {
      await admin.auth.admin.deleteUser(mate.userId);
    }
  });

  test('each sees where the other points and what the other selected; the canvas shows who is in', async ({ page, browser, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'motion', data: FRAME_DATA });
    expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: twoTitles, actor_kind: 'user', actor_id: session.userId })).error).toBeNull();
    const mate = await teammate(admin, session);

    try {
      const bo = await secondPage(browser, mate);
      await gotoHydrated(bo, `/p/${session.projectId}/c/${session.canvasId}`);
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await expect(page.getByTestId('peer-avatars').locator('li')).toHaveCount(1, { timeout: 15_000 });
      await expect(bo.getByTestId('peer-avatars').locator('li')).toHaveCount(1);

      const path = `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`;
      await gotoHydrated(page, path);
      await gotoHydrated(bo, path);
      await bo.locator('[data-clip-id="b"]').first().click();
      const stage = (await bo.getByTestId('frame-peers').boundingBox())!;
      await bo.mouse.move(stage.x + stage.width * 0.3, stage.y + stage.height * 0.4);
      await bo.mouse.move(stage.x + stage.width * 0.35, stage.y + stage.height * 0.45, { steps: 5 });

      const cursor = page.getByTestId('peer-cursor');
      await expect(cursor).toBeVisible({ timeout: 15_000 });
      await expect(cursor).toContainText(mate.email.split('@')[0]);
      await expect(page.getByTestId('peer-selection')).toHaveCount(1, { timeout: 15_000 });
      const outline = (await page.getByTestId('peer-selection').boundingBox())!;
      const area = (await page.getByTestId('frame-peers').boundingBox())!;
      expect(outline.x >= area.x && outline.y >= area.y && outline.x + outline.width <= area.x + area.width && outline.y + outline.height <= area.y + area.height, 'the outline is drawn on the stage').toBe(true);
      await expectOutlined(page, page.getByTestId('peer-selection'), 'Bo', 'the peer outline');
      await settleLate(page, 'Bo');
      await expectOutlined(page, page.getByTestId('peer-selection'), 'Bo', 'the peer outline, after the drawing settles late');
      await bo.context().close();
    } finally {
      await admin.auth.admin.deleteUser(mate.userId);
    }
  });
});
