import sharp from 'sharp';
import type { Locator, Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SETTLE_MS = 2500;
const DRAG_STEPS = 12;
const DRILL_TRIES = 4;
const SHOTS = process.env.STACK_DRAG_SHOTS ?? '';
const DOC = { width: 1920, height: 1080 };
const FIXED = { width: 'fixed', height: 'fixed', absolute: false, columnSpan: 1, rowSpan: 1 };
const COLOURS = ['#ff5a1f', '#1f8bff', '#18b46b', '#9b51e0'];
const CHILDREN = ['a', 'b', 'c', 'd'];
const NAMES = ['First', 'Second', 'Third', 'Fourth'];
const GAP = 24;
const PAD = 24;

enum Axis {
  X = 'x',
  Y = 'y'
}

type Rect = { x: number; y: number; width: number; height: number };
type Clip = Record<string, unknown>;
type Case = { name: string; axis: Axis; clips: Clip[]; first: Rect; painted?: true };

const stackOf = (id: string, direction: string, props: Clip, extra: Clip = {}): Clip => ({
  id,
  from: 0,
  durationInFrames: 150,
  component: 'Shape',
  autoLayout: { direction, wrap: false, gap: GAP, crossGap: 0, padding: { top: PAD, right: PAD, bottom: PAD, left: PAD }, justify: 'start', align: 'start', columns: 2, order: [] },
  props: { shape: 'rect', x: 0.5, y: 0.5, fills: [{ type: 'solid', color: '#eeeeee' }], ...props },
  ...extra
});

const childrenOf = (parent: string, size: { width: number; height: number }): Clip[] =>
  CHILDREN.map((id, i) => ({ id, name: NAMES[i], from: 0, durationInFrames: 150, component: 'Shape', parent, layoutItem: FIXED, props: { shape: 'rect', x: 0.5, y: 0.5, width: size.width / DOC.width, height: size.height / DOC.height, fills: [{ type: 'solid', color: COLOURS[i] }] } }));

const textsOf = (parent: string, size: { width: number; height: number }): Clip[] =>
  CHILDREN.map((id, i) => ({ id, name: NAMES[i], from: 0, durationInFrames: 150, component: 'Text', parent, layoutItem: FIXED, props: { text: `${NAMES[i]} item`, size: 0.06, x: 0.5, y: 0.5, width: size.width / DOC.width, height: size.height / DOC.height, color: COLOURS[i] } }));

const ROW = { width: 576, height: 128 };
const TILE = { width: 320, height: 200 };

const CASES: Case[] = [
  { name: 'a vertical stack in a frame', axis: Axis.Y, clips: [stackOf('col', 'vertical', { width: 0.4, height: 0.85 }), ...childrenOf('col', ROW)], first: { x: 0.3 * DOC.width + PAD, y: 0.075 * DOC.height + PAD, ...ROW }, painted: true },
  { name: 'a horizontal stack in a frame', axis: Axis.X, clips: [stackOf('col', 'horizontal', { width: 0.9, height: 0.3 }), ...childrenOf('col', TILE)], first: { x: 0.05 * DOC.width + PAD, y: 0.35 * DOC.height + PAD, ...TILE }, painted: true },
  { name: 'a stack that is the whole page, as an imported site', axis: Axis.Y, clips: [stackOf('col', 'vertical', { width: 1, height: 1 }), ...childrenOf('col', ROW)], first: { x: PAD, y: PAD, ...ROW }, painted: true },
  { name: 'texts in a vertical stack', axis: Axis.Y, clips: [stackOf('col', 'vertical', { width: 0.4, height: 0.85 }), ...textsOf('col', ROW)], first: { x: 0.3 * DOC.width + PAD, y: 0.075 * DOC.height + PAD, ...ROW } },
  {
    name: 'a stack nested in the page stack',
    axis: Axis.Y,
    clips: [stackOf('page', 'vertical', { width: 1, height: 1 }), stackOf('col', 'vertical', { width: 0.4, height: 0.85 }, { parent: 'page', layoutItem: FIXED }), ...childrenOf('col', ROW)],
    first: { x: 2 * PAD, y: 2 * PAD, ...ROW },
    painted: true
  }
];

const docOf = (c: Case) => ({ version: 5, fps: 30, ...DOC, durationInFrames: 150, background: 'brand', still: { frame: 0 }, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: c.clips }], comps: {}, assets: [] });

function childAt(c: Case, frame: Rect, index: number) {
  const unit = frame.width / DOC.width;
  const step = c.axis === Axis.Y ? { x: 0, y: c.first.height + GAP } : { x: c.first.width + GAP, y: 0 };
  return { x: frame.x + (c.first.x + step.x * index + c.first.width / 2) * unit, y: frame.y + (c.first.y + step.y * index + c.first.height / 2) * unit, unit };
}

const COLOUR_SLACK = 40;

async function colourAt(page: Page, at: { x: number; y: number }): Promise<string> {
  const { data, info } = await sharp(await page.screenshot()).raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / (page.viewportSize()?.width ?? info.width);
  const i = (Math.round(at.y * scale) * info.width + Math.round(at.x * scale)) * info.channels;
  return `#${[0, 1, 2].map((k) => data[i + k].toString(16).padStart(2, '0')).join('')}`;
}

const near = (hex: string, want: string) => [1, 3, 5].every((k) => Math.abs(parseInt(hex.slice(k, k + 2), 16) - parseInt(want.slice(k, k + 2), 16)) <= COLOUR_SLACK);

async function shot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}-${name}.png` });
  }
}

async function pick(page: Page, at: { x: number; y: number }, name: string) {
  const head = page.getByTestId('layer-name');
  await page.mouse.click(at.x, at.y);
  for (let i = 0; i < DRILL_TRIES && (await head.inputValue().catch(() => '')) !== name; i++) {
    await page.waitForTimeout(SETTLE_MS / 4);
    await (process.env.PICK_BY_DOUBLE ? page.mouse.dblclick(at.x, at.y) : page.mouse.click(at.x, at.y));
  }
  await expect(head, `clicks, one at a time, drill down to ${name}`).toHaveValue(name);
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, mid: (page: Page) => Promise<void>) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= DRAG_STEPS; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / DRAG_STEPS, from.y + ((to.y - from.y) * i) / DRAG_STEPS);
  }
  await mid(page);
  await page.mouse.up();
}

async function open(page: Page, frame: Locator, path: string) {
  await gotoHydrated(page, path);
  await expect(frame).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(SETTLE_MS);
}

test.describe('reordering a stack by dragging a child @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  for (const c of CASES) {
    test(`${c.name}: the third child dragged before the first shows where it lands, lands there, and undo puts it back`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      const node = await seedNode({ type: 'motion', x: 200, y: 100, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
      expect((await admin.from('nodes').update({ width: DOC.width / 2, height: DOC.height / 2 }).eq('id', node.id)).error).toBeNull();
      expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: docOf(c), actor_kind: 'user', actor_id: session.userId })).error).toBeNull();
      const order = async () => {
        const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
        const clips = (data?.doc as ReturnType<typeof docOf>).tracks[0].clips as { id: string; autoLayout?: { order: string[] } }[];
        const saved = clips.find((clip) => clip.id === 'col')?.autoLayout?.order ?? [];
        return saved.length ? saved : CHILDREN;
      };
      const frame = page.locator(`[data-frame="${node.id}"]`);
      await open(page, frame, `/p/${session.projectId}/c/${session.canvasId}`);

      const box = (await frame.boundingBox())!;
      const third = childAt(c, box, 2);
      await pick(page, third, NAMES[2]);
      await shot(page, `${CASES.indexOf(c)}-picked`);
      const first = childAt(c, box, 0);
      const before = c.axis === Axis.Y ? { x: first.x, y: first.y - (ROW.height / 3) * first.unit } : { x: first.x - (TILE.width / 3) * first.unit, y: first.y };
      let lines = 0;
      let leftBehind = '';
      await drag(page, third, before, async (p) => {
        lines = await p.getByTestId('stack-drop-line').count();
        leftBehind = await colourAt(p, third);
        await shot(p, `${CASES.indexOf(c)}-mid-drag`);
      });

      expect(lines, 'a drop line marks where the child lands while it is dragged').toBeGreaterThan(0);
      if (c.painted) {
        expect(near(leftBehind, COLOURS[1]), `the second child already moved into the slot the third left (saw ${leftBehind})`).toBe(true);
      }
      await expect.poll(order, { timeout: 15_000 }).toEqual(['c', 'a', 'b', 'd']);
      await shot(page, `${CASES.indexOf(c)}-dropped`);

      await page.keyboard.press('ControlOrMeta+z');
      await expect.poll(order, { timeout: 15_000 }).toEqual(CHILDREN);
    });
  }
});
