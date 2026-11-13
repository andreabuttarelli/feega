import { homedir } from 'node:os';
import sharp from 'sharp';
import type { Locator, Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const TOLERANCE_PX = 4;
const INK_MIN = 170;
const INK = '#ffffff';

type Ink = { left: number; top: number; right: number; bottom: number };
type Head = { tracks: { clips: { props: Record<string, unknown> }[] }[] };

const docOf = (props: Record<string, unknown>) => ({
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'txt', component: 'Text', from: 0, durationInFrames: 150, props: { text: 'Hello wide world', size: 0.06, color: INK, x: 0.4, y: 0.5, width: 0.3, height: 0.4, ...props } }] }],
  comps: {},
  assets: []
});

async function inkOf(page: Page, host: Locator, path: string): Promise<Ink> {
  const box = (await host.boundingBox())!;
  const png = await page.screenshot({ path, clip: box });
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => (y * info.width + x) * 3;
  const ink: Ink = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = at(x, y);
      if (Math.min(data[i], data[i + 1], data[i + 2]) < INK_MIN) {
        continue;
      }
      ink.left = Math.min(ink.left, x);
      ink.top = Math.min(ink.top, y);
      ink.right = Math.max(ink.right, x);
      ink.bottom = Math.max(ink.bottom, y);
    }
  }
  return ink;
}

function expectSame(a: Ink, b: Ink, what: string) {
  for (const side of ['left', 'top', 'right', 'bottom'] as const) {
    expect(Math.abs(a[side] - b[side]), `${what}: ${side} ${a[side]} vs ${b[side]}`).toBeLessThanOrEqual(TOLERANCE_PX);
  }
}

const MAX_DIFF_SHARE = 0.002;
const CHANNEL_NOISE = 24;

async function pixelsOf(page: Page, host: Locator, path: string): Promise<Buffer> {
  const png = await page.screenshot({ path, clip: (await host.boundingBox())! });
  return sharp(png).removeAlpha().raw().toBuffer();
}

function diffShare(a: Buffer, b: Buffer): number {
  let off = 0;
  for (let i = 0; i < a.length; i += 3) {
    off += Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > CHANNEL_NOISE ? 1 : 0;
  }
  return off / (a.length / 3);
}

const STYLES: { name: string; props: Record<string, unknown> }[] = [
  { name: 'inter-bold-tight', props: { font: 'Inter', weight: 700, tracking: -0.04 } },
  { name: 'playfair-loose', props: { font: 'Playfair Display', weight: 400, tracking: 0.08, leading: 1.6 } },
  { name: 'mono-right', props: { font: 'JetBrains Mono', align: 'right' } },
  { name: 'serif-centre-wrapped', props: { font: 'DM Serif Display', align: 'center', text: 'A long headline that wraps over several lines' } },
  { name: 'upper-tight-leading', props: { textCase: 'upper', leading: 0.9 } },
  { name: 'emoji-cjk-fallback', props: { text: 'Hello 😀 世界 $0/mo' } },
  { name: 'rich-runs', props: { text: '$0/mo', runs: [{ start: 0, end: 2, weight: 800 }, { start: 2, end: 5, color: '#ff4d4d' }] } }
];

const CASES = ['fixed', 'auto', 'auto-height'].flatMap((sizing) => ['left', 'center', 'right'].map((align) => ({ sizing, align })));

test.describe('the inline text editor draws what the canvas draws @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');
  test.use({ viewport: { width: 1600, height: 1000 } });

  for (const { sizing, align } of CASES) {
    test(`${sizing} ${align}: same glyph box before, during and after editing`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(150_000);
      const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: docOf({ sizing, align }), actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
      await expect(host).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(SETTLE_MS);
      await page.addStyleTag({ content: '[data-testid="core-text-marks"]{display:none!important}[data-testid="frame-overlays"] .selection{display:none!important}' });
      const name = `${SHOTS}/textedit-${sizing}-${align}`;
      const before = await inkOf(page, host, `${name}-before.png`);
      const box = (await host.boundingBox())!;

      await page.mouse.click(box.x + 4, box.y + 4);
      await page.waitForTimeout(SETTLE_MS);
      await page.mouse.dblclick(box.x + (before.left + before.right) / 2, box.y + (before.top + before.bottom) / 2);
      const field = page.getByTestId('core-text-edit');
      await expect(field).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press('End');
      await page.waitForTimeout(500);
      const during = await inkOf(page, host, `${name}-during.png`);

      await field.press('Escape');
      await expect(field).toHaveCount(0);
      await page.waitForTimeout(SETTLE_MS);
      const after = await inkOf(page, host, `${name}-after.png`);

      expectSame(before, during, 'during edit');
      expectSame(before, after, 'after commit');
    });
  }

  for (const { name, props } of STYLES) {
    test(`${name}: entering edit leaves the drawn pixels unchanged`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(150_000);
      const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: docOf(props), actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
      await expect(host).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(SETTLE_MS);
      await page.addStyleTag({ content: '[data-testid="core-text-marks"]{display:none!important}[data-testid="frame-overlays"] .selection{display:none!important}' });
      const shot = `${SHOTS}/textedit-parity-${name}`;
      const ink = await inkOf(page, host, `${shot}-ink.png`);
      const box = (await host.boundingBox())!;
      await page.mouse.click(box.x + 4, box.y + 4);
      await page.waitForTimeout(SETTLE_MS);
      const before = await pixelsOf(page, host, `${shot}-before.png`);

      await page.mouse.dblclick(box.x + (ink.left + ink.right) / 2, box.y + (ink.top + ink.bottom) / 2);
      await expect(page.getByTestId('core-text-edit')).toHaveCount(1, { timeout: 15_000 });
      await page.waitForTimeout(SETTLE_MS);
      const during = await pixelsOf(page, host, `${shot}-during.png`);

      expect(diffShare(before, during), `${name} pixels changed on entering edit`).toBeLessThanOrEqual(MAX_DIFF_SHARE);
    });
  }

  test('auto width hugs the typed line and the box follows it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: docOf({ sizing: 'auto-height', align: 'left' }), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
    await expect(host).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const box = (await host.boundingBox())!;
    const ink = await inkOf(page, host, `${SHOTS}/textedit-switch-0.png`);

    await page.mouse.click(box.x + 4, box.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.dblclick(box.x + (ink.left + ink.right) / 2, box.y + (ink.top + ink.bottom) / 2);
    const field = page.getByTestId('core-text-edit');
    await expect(field).toBeVisible({ timeout: 15_000 });
    await page.keyboard.type('Hello wide world and more words');
    await field.press('Escape');
    await page.waitForTimeout(SETTLE_MS);
    const wrapped = await inkOf(page, host, `${SHOTS}/textedit-switch-1.png`);
    await page.getByTestId('frame-inspector').getByRole('radio', { name: /auto width/i }).click();
    await page.waitForTimeout(SETTLE_MS);

    const hugged = await inkOf(page, host, `${SHOTS}/textedit-switch-2.png`);
    const selection = (await page.locator(`[data-frame="${frame.id}"] [data-clip="txt"]`).first().boundingBox())!;
    expect(Math.abs(selection.x - box.x - hugged.left)).toBeLessThanOrEqual(TOLERANCE_PX * 2);
    expect(Math.abs(selection.x + selection.width - box.x - hugged.right)).toBeLessThanOrEqual(TOLERANCE_PX * 2);
    expect(hugged.bottom - hugged.top).toBeLessThan((wrapped.bottom - wrapped.top) * 0.75);

    await page.waitForTimeout(SETTLE_MS);
    const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', frame.id).order('version', { ascending: false }).limit(1);
    const props = (data?.[0]?.doc as Head).tracks[0].clips[0].props;
    expect(props.sizing).toBe('auto');
    expect(Number(props.width) * 1920).toBeCloseTo(((hugged.right - hugged.left) / box.width) * 1920, -2);
  });
});
