import type { Locator, Page } from '@playwright/test';
import { withSurface } from '@feega/motion-core/motion/surface';
import { landingDoc } from '@feega/motion-core/motion/codegen/fixtures/landing';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SIZE = { width: 1440, height: 4480 };
const DATA = { format: 'custom', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const VIEWPORT = { width: 1440, height: 900 };
const VIEWS = ['tablet', 'phone'];
const MOVES = /moveElement|moveFree|placeComponent/;
const SETTLE_MS = 1_500;
const INSTANCE_CHILD = '__';
const DESCEND_MS = 2_000;

const TARGETS = {
  headline: { x: 720, y: 300 },
  actions: { x: 720, y: 517 },
  primary: { x: 640, y: 517 },
  nav: { x: 300, y: 40 },
  navButton: { x: 1290, y: 38 },
  card: { x: 360, y: 1700 }
};

type At = { x: number; y: number };

const JITTERS: At[][] = [
  [],
  [
    { x: 1, y: 0 },
    { x: 2, y: 1 }
  ],
  [
    { x: 3, y: -2 },
    { x: -1, y: 3 }
  ]
];

async function pointIn(stage: Locator, at: At) {
  const box = (await stage.boundingBox())!;
  const scale = box.width / SIZE.width;
  return { x: box.x + at.x * scale, y: box.y + at.y * scale };
}

async function shakyDouble(page: Page, at: At, jitter: At[]) {
  if (!jitter.length) {
    await page.mouse.dblclick(at.x, at.y);
    return;
  }
  for (const shake of jitter) {
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + shake.x, at.y + shake.y);
    await page.mouse.up();
  }
}

async function hoverAt(page: Page, at: At, outline: string) {
  await page.mouse.move(at.x - 3, at.y);
  await page.mouse.move(at.x, at.y);
  const box = page.getByTestId(outline);
  return (await box.count()) ? await box.getAttribute('data-hovered') : null;
}

async function leave(page: Page) {
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Escape');
  }
}

async function enterInstance(page: Page, at: At): Promise<boolean> {
  await page.mouse.click(at.x, at.y);
  if ((await selectedClip(page)) !== 'hero') {
    return false;
  }
  const path = ['hero'];
  for (let level = 0; level < 4; level++) {
    await page.mouse.dblclick(at.x, at.y);
    const descended = await expect.poll(() => selectedClip(page), { timeout: DESCEND_MS }).not.toBe(path[path.length - 1]).then(() => true, () => false);
    const now = await selectedClip(page);
    if (!descended || !now) {
      return false;
    }
    path.push(now);
    if (now.includes(INSTANCE_CHILD)) {
      return path.some((id) => /^hero-(primary|secondary)$/.test(id));
    }
  }
  return false;
}

const selectedClip = async (page: Page) => {
  const marks = page.getByTestId('frame-selection');
  return (await marks.count()) ? await marks.first().getAttribute('data-clip') : null;
};

test.describe('a double-click inside a frame never moves anything out @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');

  test('double-clicks on the frame and its breakpoint views keep every element where it was', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(300_000);
    await page.setViewportSize(VIEWPORT);
    const node = await seedNode({ type: 'motion', x: 200, y: 200, data: DATA });
    await admin.from('nodes').update(SIZE).eq('id', node.id);
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: withSurface(landingDoc(), 'surface'), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    const moves: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && MOVES.test(r.url())) {
        moves.push(r.url());
      }
    });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
    await expect(tile).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => hoverAt(page, await pointIn(tile, TARGETS.headline), 'frame-pick-box'), { timeout: 30_000 }).toBe('hero');

    const stages: Locator[] = [tile];
    for (const view of VIEWS) {
      const shown = page.locator(`[data-frame="${node.id}@bp:${view}"]`).first();
      await expect(shown).toBeVisible();
      stages.push(shown);
    }

    for (const stage of stages) {
      for (const at of Object.values(TARGETS)) {
        for (const jitter of JITTERS) {
          const box = (await stage.boundingBox())!;
          const point = { x: box.x + (at.x / SIZE.width) * box.width, y: box.y + (at.y / SIZE.width) * box.width };
          if (point.y > box.y + box.height || point.y > VIEWPORT.height - 20) {
            continue;
          }
          await shakyDouble(page, point, jitter);
          await page.keyboard.press('Escape');
          await page.keyboard.press('Escape');
        }
      }
    }
    await page.waitForTimeout(SETTLE_MS);

    expect(moves).toEqual([]);
    const { data: rows } = await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).is('deleted_at', null);
    expect(rows?.map((r) => r.id)).toEqual([node.id]);
    const { data: revisions } = await admin.from('motion_revisions').select('version, summary').eq('node_id', node.id);
    expect(revisions?.map((r) => r.summary)).toHaveLength(1);
  });

  test('double-clicks enter an instance one level at a time, then hover and click reach its children', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(240_000);
    const moves: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && MOVES.test(r.url())) {
        moves.push(r.url());
      }
    });
    await page.setViewportSize(VIEWPORT);
    const node = await seedNode({ type: 'motion', x: 200, y: 200, data: DATA });
    await admin.from('nodes').update(SIZE).eq('id', node.id);
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: withSurface(landingDoc(), 'surface'), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
    await expect(tile).toBeVisible({ timeout: 30_000 });

    const primary = await pointIn(tile, TARGETS.primary);
    await expect.poll(() => hoverAt(page, primary, 'frame-pick-box'), { timeout: 30_000 }).toBe('hero');
    expect(await enterInstance(page, primary)).toBe(true);
    const inner = await selectedClip(page);
    await page.mouse.move(primary.x, primary.y - 80);
    await expect.poll(() => hoverAt(page, primary, 'frame-pick-box')).toBe(inner);
    await page.mouse.click(primary.x, primary.y);
    await expect.poll(() => selectedClip(page)).toBe(inner);

    await leave(page);
    const tablet = page.locator(`[data-frame="${node.id}@bp:tablet"]`).first();
    await expect(tablet).toBeVisible();
    const box = (await tablet.boundingBox())!;
    const x = box.x + box.width * 0.42;
    let y = box.y + box.width * (TARGETS.headline.y / SIZE.width);
    for (; y < Math.min(box.y + box.height, VIEWPORT.height); y += 3) {
      await leave(page);
      if (await enterInstance(page, { x, y })) {
        break;
      }
    }
    const viewInner = await selectedClip(page);
    expect(viewInner).toContain(INSTANCE_CHILD);
    await page.mouse.move(x, y - 60);
    await expect.poll(() => hoverAt(page, { x, y }, 'view-pick-box')).toBe(viewInner);
    await page.mouse.click(x, y);
    await expect.poll(() => selectedClip(page)).toBe(viewInner);

    expect(moves).toEqual([]);
    const { data: rows } = await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).is('deleted_at', null);
    expect(rows?.map((r) => r.id)).toEqual([node.id]);
  });

  test('an element dragged out comes back with one undo, and the frame keeps saving after it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(VIEWPORT);
    const node = await seedNode({ type: 'motion', x: 200, y: 200, data: DATA });
    await admin.from('nodes').update(SIZE).eq('id', node.id);
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: withSurface(landingDoc(), 'surface'), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    const failures: string[] = [];
    page.on('response', (r) => {
      if (r.request().method() === 'POST' && r.status() >= 400) {
        failures.push(`${r.status()} ${r.url()}`);
      }
    });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
    await expect(tile).toBeVisible({ timeout: 30_000 });
    const headline = await pointIn(tile, TARGETS.headline);
    await expect.poll(() => hoverAt(page, headline, 'frame-pick-box'), { timeout: 30_000 }).toBe('hero');

    const live = async () => (await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).is('deleted_at', null)).data?.length ?? 0;
    const head = async () => JSON.stringify((await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single()).data?.doc);
    const dragOut = async () => {
      await page.mouse.click(headline.x, headline.y);
      await page.mouse.dblclick(headline.x, headline.y);
      await expect.poll(() => selectedClip(page)).toBe('headline');
      const box = (await tile.boundingBox())!;
      await page.mouse.move(headline.x, headline.y);
      await page.mouse.down();
      await page.mouse.move(headline.x, box.y - 40, { steps: 12 });
      await page.mouse.move(headline.x, box.y - 80, { steps: 4 });
      const moved = page.waitForResponse((r) => r.url().includes('action=moveElement'));
      await page.mouse.up();
      await moved;
      await expect.poll(live).toBe(2);
      await expect(page.locator('[data-testid="gpu-node"]')).toHaveCount(2);
      await expect.poll(head).not.toContain('"id":"headline"');
    };

    await dragOut();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(live).toBe(1);
    await expect.poll(head).toContain('"id":"headline"');

    await dragOut();
    const lede = await pointIn(tile, { x: 720, y: 430 });
    await page.mouse.click(lede.x, lede.y);
    await page.mouse.dblclick(lede.x, lede.y);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await admin.from('motion_revisions').select('summary').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single()).data?.summary, { timeout: 15_000 }).not.toMatch(/Moved an element to another frame|Undid/);
    expect(await head()).not.toContain('"id":"headline"');
    expect(failures).toEqual([]);
  });
});
