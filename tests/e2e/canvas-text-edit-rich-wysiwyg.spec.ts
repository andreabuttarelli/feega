import { homedir } from 'node:os';
import sharp from 'sharp';
import type { Locator, Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const TOLERANCE_PX = 4;
const INK_MIN = 170;
const ROW_GAP_PX = 2;

type Row = { left: number; top: number; right: number; bottom: number };

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        {
          id: 'txt',
          component: 'Text',
          from: 0,
          durationInFrames: 150,
          props: {
            text: 'Plain intro\nBold big item\nNested italic\nLast numbered',
            size: 0.045,
            color: '#ffffff',
            x: 0.45,
            y: 0.5,
            width: 0.6,
            height: 0.6,
            align: 'left',
            verticalAlign: 'top',
            paragraphSpacing: 0.4,
            runs: [
              { start: 12, end: 16, weight: 700, size: 0.07 },
              { start: 26, end: 32, italic: true, color: '#ffffcc', underline: true }
            ],
            lists: [null, { kind: 'bullet', level: 0 }, { kind: 'bullet', level: 1 }, { kind: 'number', level: 0 }]
          }
        }
      ]
    }
  ],
  comps: {},
  assets: []
};

async function rowsOf(page: Page, host: Locator, path: string): Promise<Row[]> {
  const box = (await host.boundingBox())!;
  const png = await page.screenshot({ path, clip: box });
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const inked = (x: number, y: number) => {
    const i = (y * info.width + x) * 3;
    return Math.min(data[i], data[i + 1], data[i + 2]) >= INK_MIN;
  };
  const rows: Row[] = [];
  let open: Row | null = null;
  let blank = 0;
  for (let y = 0; y < info.height; y++) {
    let left = Infinity;
    let right = -Infinity;
    for (let x = 0; x < info.width; x++) {
      if (inked(x, y)) {
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    if (right < 0) {
      blank++;
      if (open && blank > ROW_GAP_PX) {
        rows.push(open);
        open = null;
      }
      continue;
    }
    blank = 0;
    open = open ? { left: Math.min(open.left, left), top: open.top, right: Math.max(open.right, right), bottom: y } : { left, top: y, right, bottom: y };
  }
  if (open) {
    rows.push(open);
  }
  return rows;
}

function expectSame(a: Row[], b: Row[], what: string) {
  expect(b.length, `${what}: rows`).toBe(a.length);
  a.forEach((row, i) => {
    for (const side of ['left', 'top', 'right', 'bottom'] as const) {
      expect(Math.abs(row[side] - b[i][side]), `${what}: row ${i} ${side} ${row[side]} vs ${b[i][side]}`).toBeLessThanOrEqual(TOLERANCE_PX);
    }
  });
}

test.describe('the inline editor draws styled runs and lists as the canvas does @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');
  test.use({ viewport: { width: 1600, height: 1000 } });

  test('mid-edit glyphs and list markers match the committed render', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    await page.addStyleTag({ content: '[data-testid="core-text-edit"]{outline:none!important;caret-color:transparent!important}[data-testid="frame-overlays"] .selection{display:none!important}' });
    const before = await rowsOf(page, host, `${SHOTS}/editor-rich-before.png`);
    expect(before.length, 'four paragraphs drawn').toBe(4);
    const box = (await host.boundingBox())!;

    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.dblclick(box.x + (before[0].left + before[0].right) / 2, box.y + (before[0].top + before[0].bottom) / 2);
    const field = page.getByTestId('core-text-edit');
    await expect(field).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    const during = await rowsOf(page, host, `${SHOTS}/editor-rich-during.png`);

    await field.press('Escape');
    await expect(field).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);
    const after = await rowsOf(page, host, `${SHOTS}/editor-rich-after.png`);

    expectSame(before, during, 'during edit');
    expectSame(before, after, 'after commit');
    expect(during[2].left, 'the nested marker sits right of its parent').toBeGreaterThan(during[1].left + TOLERANCE_PX);
  });
});
