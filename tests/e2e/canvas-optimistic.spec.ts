import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SLOW_SERVER_MS = Number(process.env.OPTIMISTIC_DELAY_MS ?? 2_000);
const FRAME_BUDGET = 2;
const MEASURING = process.env.OPTIMISTIC_MEASURE === '1';
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const READS = new Set(['snapshot', 'revision', 'canvasComments', 'audio_voices']);

const sheet = (id: string, shape: string) => ({
  version: 5,
  fps: 30,
  width: 200,
  height: 200,
  durationInFrames: 150,
  background: 'transparent',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape, x: 0.5, y: 0.5, width: 1, height: 1 } }] }],
  comps: {},
  assets: []
});

const blankFrame = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }], comps: {}, assets: [] };

type Seed = (s: { type: string; x: number; y: number; data: Record<string, unknown> }) => Promise<{ id: string }>;
type Owner = { orgId: string; userId: string };

async function element(admin: SupabaseClient, seedNode: Seed, owner: Owner, i: number): Promise<string> {
  const node = await seedNode({ type: 'motion', x: 120 + i * 220, y: 160, data: { ...LANDSCAPE, kind: 'element' } });
  await admin.from('nodes').update({ width: 120, height: 120 }).eq('id', node.id);
  const { error } = await admin.from('motion_revisions').insert({ org_id: owner.orgId, node_id: node.id, version: 1, doc: sheet(`o${i}`, i % 2 ? 'ellipse' : 'rect'), actor_kind: 'user', actor_id: owner.userId });
  expect(error).toBeNull();
  return node.id;
}

async function frame(admin: SupabaseClient, seedNode: Seed, owner: Owner): Promise<string> {
  const node = await seedNode({ type: 'motion', x: 120, y: 420, data: LANDSCAPE });
  const { error } = await admin.from('motion_revisions').insert({ org_id: owner.orgId, node_id: node.id, version: 1, doc: blankFrame, actor_kind: 'user', actor_id: owner.userId });
  expect(error).toBeNull();
  return node.id;
}

enum Shown {
  Gone = 'gone',
  Changed = 'changed',
  OnTop = 'on-top',
  Named = 'named',
  Present = 'present',
  Absent = 'absent'
}

type Expect = { shown: Shown; id?: string; name?: string; selector?: string };

async function watch(page: Page, want: Expect) {
  await page.evaluate((w) => {
    const probe = { start: 0, shown: 0, frames: 0 };
    (window as unknown as { uiProbe: typeof probe }).uiProbe = probe;
    const tiles = () => [...document.querySelectorAll<HTMLElement>('[data-testid="gpu-node"]')];
    const idsNow = () => tiles().map((t) => t.dataset.id).sort().join();
    const initial = idsNow();
    const met: Record<string, () => boolean> = {
      gone: () => !tiles().some((t) => t.dataset.id === w.id),
      changed: () => idsNow() !== initial,
      'on-top': () => tiles().at(-1)?.dataset.id === w.id,
      named: () => tiles().some((t) => t.dataset.id === w.id && t.getAttribute('aria-label') === w.name),
      present: () => !!document.querySelector(w.selector!),
      absent: () => !document.querySelector(w.selector!)
    };
    const begin = () => {
      if (probe.start) {
        return;
      }
      probe.start = performance.now();
      const tick = () => {
        probe.frames += 1;
        if (met[w.shown]()) {
          probe.shown = performance.now();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    window.addEventListener('keydown', begin, { capture: true, once: true });
    window.addEventListener('pointerup', begin, { capture: true, once: true });
  }, want);
}

async function landed(page: Page): Promise<{ ms: number; frames: number }> {
  await expect.poll(() => page.evaluate(() => (window as unknown as { uiProbe: { shown: number } }).uiProbe.shown), { timeout: 15_000 }).toBeGreaterThan(0);
  const probe = await page.evaluate(() => (window as unknown as { uiProbe: { start: number; shown: number; frames: number } }).uiProbe);
  return { ms: Math.round(probe.shown - probe.start), frames: probe.frames };
}

async function slowServer(page: Page) {
  if (MEASURING) {
    return;
  }
  await page.route(
    (url) => url.searchParams.has('action') && !READS.has(url.searchParams.get('action') ?? ''),
    async (route) => {
      await new Promise((done) => setTimeout(done, SLOW_SERVER_MS));
      await route.continue();
    }
  );
}

async function verdict(name: string, page: Page) {
  const took = await landed(page);
  test.info().annotations.push({ type: 'latency', description: `${name}: ${took.ms} ms, ${took.frames} frames` });
  console.log(`latency ${name}: ${took.ms} ms, ${took.frames} frames`);
  if (!MEASURING) {
    expect(took.frames, `${name} shows before the server answers`).toBeLessThanOrEqual(FRAME_BUDGET);
  }
}

async function open(page: Page, session: { projectId: string; canvasId: string }) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
  await slowServer(page);
  await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
}

const thread = (id: string) => `[data-testid="comment-thread"][data-thread="${id}"]`;

async function comment(admin: SupabaseClient, session: Owner & { canvasId: string }, body: string, parentId: string | null = null): Promise<string> {
  const { data, error } = await admin.from('canvas_comments').insert({ org_id: session.orgId, canvas_id: session.canvasId, author_id: session.userId, parent_id: parentId, body, x: 40, y: 40 }).select('id').single();
  expect(error).toBeNull();
  return data!.id as string;
}

async function openComments(page: Page, session: { projectId: string; canvasId: string }) {
  await open(page, session);
  await page.keyboard.press('Alt+1');
  await page.getByTestId('canvas-more').click();
  await page.getByTestId('canvas-comments').click();
  await expect(page.getByTestId('comments-panel')).toBeVisible();
}

const tile = (page: Page, id: string) => page.locator(`[data-testid="gpu-node"][data-id="${id}"]`);

async function pick(page: Page, id: string) {
  await page.locator(`[data-motion-node="${id}"]`).click();
  await page.keyboard.press('Escape');
}

async function centre(page: Page, id: string) {
  const box = (await tile(page, id).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('canvas actions are optimistic @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('delete removes the tile before the server answers', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const id = await element(admin, seedNode, session, 0);
    await open(page, session);
    await pick(page, id);
    await watch(page, { shown: Shown.Gone, id });
    await page.keyboard.press('Delete');
    await verdict('delete', page);
  });

  test('group draws the group before the server answers', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await element(admin, seedNode, session, 0);
    await element(admin, seedNode, session, 1);
    await open(page, session);
    await page.keyboard.press('ControlOrMeta+a');
    await watch(page, { shown: Shown.Changed });
    await page.keyboard.press('ControlOrMeta+g');
    await verdict('group', page);
  });

  test('wrap with stack draws the stack before the server answers', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await element(admin, seedNode, session, 0);
    await element(admin, seedNode, session, 1);
    await open(page, session);
    await page.keyboard.press('ControlOrMeta+a');
    await watch(page, { shown: Shown.Changed });
    await page.keyboard.press('Shift+A');
    await verdict('wrap-stack', page);
  });

  test('wrap in a section draws the section before the server answers', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await element(admin, seedNode, session, 0);
    await element(admin, seedNode, session, 1);
    await open(page, session);
    await page.keyboard.press('ControlOrMeta+a');
    await watch(page, { shown: Shown.Changed });
    await page.keyboard.press('Shift+S');
    await verdict('wrap-section', page);
  });

  test('bring to front reorders before the server answers', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const first = await element(admin, seedNode, session, 0);
    await element(admin, seedNode, session, 1);
    await open(page, session);
    await pick(page, first);
    await watch(page, { shown: Shown.OnTop, id: first });
    await page.keyboard.press('ControlOrMeta+]');
    await verdict('bring-front', page);
  });

  test('a free element dropped on a frame leaves the canvas before the server answers', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const free = await element(admin, seedNode, session, 0);
    const host = await frame(admin, seedNode, session);
    await open(page, session);
    const from = await centre(page, free);
    const to = await centre(page, host);
    await watch(page, { shown: Shown.Gone, id: free });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 20 });
    await page.mouse.up();
    await verdict('move-into-frame', page);
  });

  test('a new comment shows before the server answers, and is stored under the id it shows', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await openComments(page, session);
    await page.getByTestId('comment-draft').fill('Tighten the headline');
    await watch(page, { shown: Shown.Present, selector: '[data-testid="comment-thread"]' });
    await page.getByTestId('comment-add').click();
    await verdict('comment-add', page);
    const shown = await page.getByTestId('comment-thread').getAttribute('data-thread');
    await expect.poll(async () => (await admin.from('canvas_comments').select('id').eq('id', shown!)).data?.length, { timeout: 15_000 }).toBe(1);
  });

  test('a comment reply shows before the server answers', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    const root = await comment(admin, session, 'Move this left');
    await openComments(page, session);
    await page.locator(thread(root)).getByTestId('comment-reply-input').fill('Done');
    await watch(page, { shown: Shown.Present, selector: `${thread(root)} [data-testid="comment-reply"]` });
    await page.locator(thread(root)).getByTestId('comment-reply-send').click();
    await verdict('comment-reply', page);
  });

  test('an edited comment shows before the server answers', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    const root = await comment(admin, session, 'Fist draft');
    await openComments(page, session);
    await page.locator(thread(root)).getByTestId('comment-edit').first().click();
    await page.getByTestId('comment-edit-input').fill('First draft');
    await watch(page, { shown: Shown.Present, selector: `${thread(root)} [data-testid="comment-edited"]` });
    await page.getByTestId('comment-edit-save').click();
    await verdict('comment-edit', page);
  });

  test('a deleted comment leaves before the server answers', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    const root = await comment(admin, session, 'Remove me');
    await openComments(page, session);
    await watch(page, { shown: Shown.Absent, selector: thread(root) });
    await page.locator(thread(root)).getByTestId('comment-delete').first().click();
    await verdict('comment-delete', page);
  });

  test('a resolved comment thread folds away before the server answers', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    const root = await comment(admin, session, 'Fix the kerning');
    await openComments(page, session);
    await watch(page, { shown: Shown.Absent, selector: thread(root) });
    await page.locator(thread(root)).getByTestId('comment-resolve').click();
    await verdict('comment-resolve', page);
  });
});
