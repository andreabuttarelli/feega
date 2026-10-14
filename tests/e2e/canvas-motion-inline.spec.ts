import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';
import sharp from 'sharp';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const START = /^00:00:00 \//;
const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const PHONE = { width: 390, height: 844 };
const TABLET = { width: 820, height: 1180 };

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

const latestVersion = async (admin: Parameters<Parameters<typeof test>[2]>[0]['admin'], nodeId: string) =>
  (await admin.from('motion_revisions').select('version').eq('node_id', nodeId).order('version', { ascending: false }).limit(1)).data?.[0]?.version ?? 0;

const JPEG = 'data:image/jpeg;base64,';
const sse = (parts: unknown[]) => [...parts.map((p) => `data: ${JSON.stringify(p)}\n\n`), 'data: [DONE]\n\n'].join('');
const askFrames = (callId: string) => sse([{ type: 'start' }, { type: 'data-motion-frames', data: { callId, times: [0.5, 1.5], doc } }, { type: 'finish' }]);

const OPEN_AGENT: Record<string, (page: Page) => Promise<void>> = {
  phone: (page) => page.getByRole('navigation', { name: 'Panels' }).getByRole('button', { name: 'Agent' }).click(),
  tablet: (page) => page.getByTestId('toggle-chat').click(),
  desktop: async () => {}
};

const emptyCanvasPoint = (page: Page) =>
  page.evaluate(() => {
    for (let y = 60; y < innerHeight; y += 20) {
      for (let x = 80; x < innerWidth; x += 20) {
        if (document.elementFromPoint(x, y)?.classList.contains('svelte-flow__pane')) {
          return { x, y };
        }
      }
    }
    return null;
  });

const LIT_LUMA = 60;
const PAPER_LUMA = 200;
const CENTRE_TOLERANCE_PX = 24;
const DESKTOP_WIDE = { width: 1440, height: 900 };

async function shareAbove(shot: Buffer, luma: number): Promise<number> {
  const { data, info } = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let lit = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] > luma) {
      lit++;
    }
  }
  return lit / (data.length / info.channels);
}

async function freeCentre(page: Page) {
  return page.evaluate(() => {
    const boxes = (dock: string) => [...document.querySelectorAll(`[data-dock="${dock}"]`)].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0);
    const flow = document.querySelector('.svelte-flow')!.getBoundingClientRect();
    const top = Math.max(flow.top, ...boxes('top-bar').map((r) => r.bottom));
    const bottom = Math.min(flow.bottom, ...boxes('timeline').map((r) => r.top));
    const right = Math.min(flow.right, ...boxes('right-panel').map((r) => r.left));
    return { x: (flow.left + right) / 2, y: (top + bottom) / 2 };
  });
}

const OVERLAP_TOLERANCE_PX = 2;
const INSET = 0.1;
const MIN_LIT_SHARE = 0.005;

async function expectOnNode(page: Page, node: Locator) {
  const body = node.getByTestId('motion-node-editing');
  await expect
    .poll(
      async () => {
        const [stage, host] = [await page.getByTestId('editor-stage').boundingBox(), await body.boundingBox()];
        return stage && host ? Math.max(Math.abs(stage.x - host.x), Math.abs(stage.y - host.y), Math.abs(stage.width - host.width), Math.abs(stage.height - host.height)) : Infinity;
      },
      { timeout: 15_000, message: 'the editor player covers the node body exactly' }
    )
    .toBeLessThan(OVERLAP_TOLERANCE_PX);
}

async function expectLit(page: Page) {
  const stage = page.getByTestId('editor-stage');
  const inner = async () => {
    const box = (await stage.boundingBox())!;
    return page.screenshot({ clip: { x: box.x + box.width * INSET, y: box.y + box.height * INSET, width: box.width * (1 - 2 * INSET), height: box.height * (1 - 2 * INSET) } });
  };
  await expect.poll(async () => shareAbove(await inner(), LIT_LUMA), { timeout: 15_000, message: 'the title draws inside the node, not a black box' }).toBeGreaterThan(MIN_LIT_SHARE);
}

async function expectOneBurger(page: Page) {
  await expect(page.locator('.burger-btn:visible, [data-testid="menu-open"]:visible'), 'one burger on top, never the canvas one and the editor one').toHaveCount(1);
}

async function expectOneBar(page: Page) {
  const top = (await page.locator('.canvas-topbar').boundingBox())!;
  const bar = (await page.getByTestId('editor-bar').boundingBox())!;
  expect(bar.y, 'the editor bar sits inside the canvas top bar').toBeGreaterThanOrEqual(top.y - 1);
  expect(bar.y + bar.height, 'one bar on top, not two rows').toBeLessThanOrEqual(top.y + top.height + 1);
  await expect(page.locator('.canvas-topbar').getByRole('button', { name: /E2E project/ })).toBeVisible();
}

async function expectFramed(page: Page, node: Locator) {
  await expectOnNode(page, node);
  await expectLit(page);

  await expect
    .poll(
      async () => {
        const box = (await node.boundingBox())!;
        const centre = await freeCentre(page);
        return Math.max(Math.abs(box.x + box.width / 2 - centre.x), Math.abs(box.y + box.height / 2 - centre.y));
      },
      { timeout: 5000, message: 'the edited node is centred in the room the panels leave' }
    )
    .toBeLessThan(CENTRE_TOLERANCE_PX);

  await expect
    .poll(
      async () => {
        const [picture, body] = [await page.getByTestId('motion-preview').boundingBox(), await node.getByTestId('motion-node-editing').boundingBox()];
        return picture && body ? Math.max(Math.abs(picture.width - body.width), Math.abs(picture.height - body.height)) : Infinity;
      },
      { timeout: 10_000, message: 'the node takes the shape of the graphic: the picture fills its body, no bands' }
    )
    .toBeLessThan(OVERLAP_TOLERANCE_PX * 2);

  const [frameBox, addBar] = [await node.boundingBox(), await page.locator('.add-bar').boundingBox()];
  if (frameBox && addBar) {
    expect(addBar.y >= frameBox.y + frameBox.height || addBar.y + addBar.height <= frameBox.y || addBar.x >= frameBox.x + frameBox.width || addBar.x + addBar.width <= frameBox.x, 'the add bar never covers the edited frame').toBe(true);
  }

  await expect(page.getByRole('toolbar', { name: 'Selection actions' })).toHaveCount(0);
}

const SHARP_EDGE = 130;
const RULER_FILL = 0.85;
const PHONE_HEAD_SHARE = 0.25;

async function sharpestEdge(shot: Buffer): Promise<number> {
  const { data, info } = await sharp(shot).greyscale().raw().toBuffer({ resolveWithObject: true });
  let max = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 1; x < info.width; x++) {
      max = Math.max(max, Math.abs(data[y * info.width + x] - data[y * info.width + x - 1]));
    }
  }
  return max;
}

async function expectTimelineFits(page: Page) {
  const timeline = (await page.getByTestId('motion-timeline').boundingBox())!;
  const head = (await page.getByTestId('motion-timeline').locator('.head').first().boundingBox())!;
  const clip = (await page.locator('[data-clip-id="t"]').boundingBox())!;
  expect(clip.width, 'the 3 s video fills the ruler, no empty right half').toBeGreaterThan((timeline.width - head.width) * RULER_FILL);
  return { timeline, head };
}

async function openOnPhone(page: Page) {
  const stage = page.getByTestId('motion-node-stage').first();
  await stage.click({ position: { x: 60, y: 10 } });
  await stage.getByTestId('open-motion-editor').click();
}

const NEIGHBOUR_MIN_OPACITY = 0.75;

const viewportTransform = (page: Page) => page.locator('.svelte-flow__viewport').evaluate((el) => getComputedStyle(el).transform);

test.use({ video: SHOTS ? 'on' : 'off' });

test.describe('motion editor inside the canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test.beforeEach(async ({ session, admin, seedNode }, info) => {
    for (const x of [80, 470]) {
      const node = await seedNode({ type: 'motion', x, y: 120, data: LANDSCAPE });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      info.annotations.push({ type: 'node', description: node.id });
    }
  });

  test('the node becomes the editor player; timeline, keys and undo follow focus; the canvas stays live', async ({ page, session, admin }, info) => {
    const [first, second] = info.annotations.filter((a) => a.type === 'node').map((a) => a.description!);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await shoot(page, '1-canvas');

    const nodeOf = (id: string) => page.locator(`.svelte-flow__node[data-id="${id}"]`);
    await nodeOf(first).getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });

    const editor = page.getByTestId('motion-editor');
    await expect(editor).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
    await expectOnNode(page, nodeOf(first));
    await expect(page.getByTestId('motion-preview')).toHaveCount(1);
    await expect(page).toHaveURL(new RegExp(`/c/${session.canvasId}$`));
    await expect(page.getByRole('region', { name: 'Timeline', exact: true })).toBeVisible();
    await expect(page.getByLabel('Agent', { exact: true })).toBeVisible();
    await expectFramed(page, nodeOf(first));
    await expectOneBar(page);
    await expectOneBurger(page);
    await shoot(page, '2-open');

    const timecode = editor.getByTestId('timecode');
    await editor.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(timecode).not.toHaveText(START, { timeout: 5000 });
    await shoot(page, '3-playing');
    await editor.getByRole('button', { name: 'Pause', exact: true }).click();

    await editor.locator('[data-clip-id]').first().click();
    await page.keyboard.press('Delete');
    await expect(editor.locator('[data-clip-id]')).toHaveCount(0);
    await expect.poll(() => latestVersion(admin, first), { timeout: 10_000 }).toBeGreaterThan(1);
    await shoot(page, '4-edited');

    await page.keyboard.press('ControlOrMeta+z');
    await expect(editor.locator('[data-clip-id]')).toHaveCount(1);
    expect((await admin.from('nodes').select('deleted_at').eq('id', first).single()).data?.deleted_at).toBeNull();

    const before = await viewportTransform(page);
    const spot = await emptyCanvasPoint(page);
    expect(spot).not.toBeNull();
    await page.mouse.move(spot!.x, spot!.y);
    await page.mouse.wheel(0, -100);
    await expect.poll(() => viewportTransform(page)).not.toBe(before);
    await expect(editor).toBeVisible();

    await nodeOf(second).getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expectOnNode(page, nodeOf(second));
    await expect(page.getByTestId('motion-preview')).toHaveCount(1);
    await shoot(page, '5-switched');

    const empty = await emptyCanvasPoint(page);
    expect(empty).not.toBeNull();
    await page.mouse.click(empty!.x, empty!.y);
    await expect(editor).toHaveCount(0);
    await shoot(page, '6-closed');
  });

  test('at 1440x900 the edited node is framed, centred and drawn', async ({ page, session }, info) => {
    const [first] = info.annotations.filter((a) => a.type === 'node').map((a) => a.description!);
    await page.setViewportSize(DESKTOP_WIDE);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const node = page.locator(`.svelte-flow__node[data-id="${first}"]`);
    await node.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });

    await expectFramed(page, node);
    await expectOneBar(page);
    await expectOneBurger(page);

    await page.getByRole('tab', { name: 'Properties' }).click();
    const frame = page.getByTestId('composition-inspector');
    await expect(frame, 'with the frame selected and nothing inside it, Properties shows the frame').toBeVisible();
    await expect(frame).toContainText('Format');
    await expect(frame).toContainText('Length');
    await expectTimelineFits(page);
    await expectLit(page);
    await shoot(page, '2-open-1440');
  });

  test('the agent sees frames captured by the player inside the node', async ({ page, session }, info) => {
    const [first] = info.annotations.filter((a) => a.type === 'node').map((a) => a.description!);
    const stored: string[] = [];
    await page.route(/\/motion\/[^/]+\/agent$/, (route) =>
      route.request().method() === 'POST' ? route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: askFrames('call_inline') }) : route.fallback()
    );
    page.on('response', (res) => {
      if (!res.url().endsWith('/agent/frames') || !res.ok()) {
        return;
      }
      const body = res.request().postDataJSON() as { callId: string; frames: { data: string }[] };
      if (body.frames.length === 2 && body.frames.every((f) => f.data.startsWith(JPEG))) {
        stored.push(body.callId);
      }
    });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`.svelte-flow__node[data-id="${first}"]`).getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    const input = page.getByLabel('Agent', { exact: true }).locator('textarea');
    await input.fill('look');
    await input.press('Enter');
    await expect.poll(() => stored, { timeout: 20_000 }).toContain('call_inline');
  });

  test('the layers panel docks left, opens the video from its node, selects a clip and moves a track, persisted', async ({ page, session, admin }, info) => {
    const [first] = info.annotations.filter((a) => a.type === 'node').map((a) => a.description!);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const stageBefore = await page.locator('.canvas-stage').boundingBox();

    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    await expect(layers).toBeVisible();
    expect((await page.locator('.canvas-stage').boundingBox())!.x).toBeGreaterThan(stageBefore!.x + 100);

    await expect(layers.locator(`[data-layer="${first}"]`), 'the node is called Frame').toContainText('Frame');
    await layers.locator(`[data-layer="${first}"]`).click();
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
    const clip = layers.locator('[data-layer="t"]');
    await clip.click();
    await expect(clip).toHaveAttribute('aria-selected', 'true');

    await layers.locator('[data-layer="v1"]').click();
    await page.keyboard.press('ControlOrMeta+BracketLeft');
    await expect
      .poll(async () => ((await admin.from('motion_revisions').select('doc').eq('node_id', first).order('version', { ascending: false }).limit(1)).data?.[0]?.doc as { tracks: { id: string }[] } | undefined)?.tracks.map((t) => t.id), { timeout: 10_000 })
      .toEqual(['a1', 'v1']);
    await page.waitForTimeout(800);
    await shoot(page, '7-layers');
  });

  test('on a phone the title in the node is drawn sharp, at the size it is shown', async ({ page, session }) => {
    await page.setViewportSize(PHONE);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await openOnPhone(page);
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
    await page.waitForTimeout(2500);

    const player = (await page.getByTestId('motion-preview').boundingBox())!;
    const onScreen = await sharp(await page.screenshot()).extract({ left: Math.ceil(player.x), top: Math.ceil(player.y), width: Math.floor(player.width) - 1, height: Math.floor(player.height) - 1 }).png().toBuffer();
    expect(await sharpestEdge(onScreen), 'the title is drawn sharp, not scaled up').toBeGreaterThan(SHARP_EDGE);
  });

  for (const [name, size] of [['phone', PHONE], ['tablet', TABLET]] as const) {
    test(`on a ${name} the node is the player and the panels fit`, async ({ page, session }) => {
      await page.setViewportSize(size);
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      if (name === 'phone') {
        await openOnPhone(page);
      } else {
        await page.getByTestId('motion-node-stage').first().click({ position: { x: 60, y: 10 } });
      }

      const editor = page.getByTestId('motion-editor');
      await expect(editor).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
      await expectOnNode(page, page.locator('.svelte-flow__node').filter({ has: page.getByTestId('motion-node-editing') }));
      await expect(page.getByRole('region', { name: 'Timeline', exact: true })).toBeVisible();
      await page.waitForTimeout(2500);
      const { timeline, head } = await expectTimelineFits(page);
      await expectOneBurger(page);
      await shoot(page, `${name}-open`);

      if (name === 'phone') {
        expect(head.width, 'layer names take a narrow column on a phone').toBeLessThanOrEqual(timeline.width * PHONE_HEAD_SHARE);
        await expect(page.locator('.mobile-topbar'), 'one bar on top while editing').toBeHidden();
        const opacities = await page.locator('.svelte-flow__node').evaluateAll((nodes) => nodes.map((n) => Number(getComputedStyle(n).opacity)));
        expect(Math.min(...opacities), 'the other nodes stay on the canvas while a frame is edited').toBeGreaterThanOrEqual(NEIGHBOUR_MIN_OPACITY);
      }

      await OPEN_AGENT[(await editor.getAttribute('data-viewport')) ?? 'desktop'](page);
      await page.waitForTimeout(800);
      await expect(page.getByLabel('Agent', { exact: true })).toBeVisible();
      await shoot(page, `${name}-agent`);
    });
  }
});
