import type { Page } from '@playwright/test';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.SHOT_PREFIX ?? '';
const SETTLE_MS = 2500;
const SIZE_TOLERANCE_PX = 2;
const HOVER_TOLERANCE_PX = 3;
const ALIGN_TOLERANCE = 0.001;
const ROTATION = 20;
const shape = (id: string, x: number, color: string, extra: Record<string, unknown> = {}, mask?: object) => ({
  id,
  from: 0,
  durationInFrames: 150,
  component: 'Shape',
  ...(mask ? { mask } : {}),
  props: { shape: 'rect', x, y: 0.5, width: 0.2, height: 0.3, fills: [{ type: 'solid', color }], ...extra }
});
const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [shape('a', 0.2, '#ff5a1f'), shape('b', 0.5, '#1f5aff', { y: 0.7 }), shape('m', 0.85, '#1fbf5a', { width: 0.15 }, { kind: 'rect', x: 0.5, y: 0.5, width: 1, height: 1 })]
    }
  ],
  comps: {},
  assets: []
};

const CORNER_INSET_PX = 4;
const LIGHT_MIN = 100;

async function lightnessAt(page: Page, at: { x: number; y: number }): Promise<number> {
  const png = (await page.screenshot()).toString('base64');
  return page.evaluate(
    async ({ png, at }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const scale = img.width / window.innerWidth;
      const [r, g, b] = ctx.getImageData(Math.round(at.x * scale), Math.round(at.y * scale), 1, 1).data;
      return (r + g + b) / 3;
    },
    { png, at }
  );
}

type Clip = { id: string; props: Record<string, unknown> };

async function shot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}-${name}.png` });
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('feega.frame-edit-mode', 'design'));
});

test.describe('draw, mask and align inside a core frame @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  for (const rotation of [0, ROTATION]) {
    test(`rotation ${rotation}`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, rotation } });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      const frame = page.locator(`[data-frame="${node.id}"]`);
      await page.waitForTimeout(SETTLE_MS);

      const at = async (u: number, v: number) => {
        const r = (await frame.boundingBox())!;
        const rad = (rotation * Math.PI) / 180;
        const [c, n] = [Math.cos(rad), Math.sin(rad)];
        const det = c * c - n * n;
        const w = (r.width * c - r.height * n) / det;
        const h = (r.height * c - r.width * n) / det;
        const dx = (u - 0.5) * w;
        const dy = (v - 0.5) * h;
        return { x: r.x + r.width / 2 + dx * c - dy * n, y: r.y + r.height / 2 + dx * n + dy * c };
      };
      const clips = async (): Promise<Clip[]> => {
        const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
        return (data!.doc as typeof doc).tracks.flatMap((t) => t.clips) as Clip[];
      };

      const first = await at(0.2, 0.5);
      await page.mouse.click(first.x, first.y);
      await page.waitForTimeout(SETTLE_MS);
      await page.mouse.click(first.x, first.y);
      await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });
      const size = (await frame.boundingBox())!;
      const stays = async () => {
        const now = (await frame.boundingBox())!;
        expect(Math.abs(now.width - size.width)).toBeLessThan(SIZE_TOLERANCE_PX);
        expect(Math.abs(now.height - size.height)).toBeLessThan(SIZE_TOLERANCE_PX);
        await expect(frame).toBeVisible();
      };
      await shot(page, `${rotation}-selected`);
      const corner = { x: size.x + size.width - CORNER_INSET_PX, y: size.y + CORNER_INSET_PX };
      if (rotation) {
        expect(await lightnessAt(page, corner), 'the frame background turns with the frame').toBeGreaterThan(LIGHT_MIN);
      }

      await pickBarTool(page, 'pen');
      await expect(page.getByTestId('draw-overlay')).toHaveCount(1);
      for (const [u, v] of [[0.62, 0.1], [0.78, 0.1], [0.7, 0.3]]) {
        const p = await at(u, v);
        await page.mouse.click(p.x, p.y);
      }
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('pen-overlay')).toHaveCount(1, { timeout: 15_000 });
      await shot(page, `${rotation}-pen`);
      await stays();
      await expect.poll(async () => (await clips()).some((c) => c.props.shape === 'path'), { timeout: 30_000 }).toBe(true);

      await page.getByRole('button', { name: 'Pen', exact: true }).click();
      await page.locator('[data-layer="m"]').click();
      await expect(page.getByTestId('mask-overlay')).toHaveCount(1, { timeout: 15_000 });
      await shot(page, `${rotation}-mask`);
      await stays();

      await page.locator('[data-layer="a"]').click();
      const b = await at(0.5, 0.7);
      await page.mouse.move(b.x, b.y);
      const hover = page.getByTestId('frame-pick-box');
      await expect(hover).toHaveCount(1, { timeout: 15_000 });
      const ghost = (await hover.boundingBox())!;
      await page.keyboard.down('Shift');
      await page.mouse.click(b.x, b.y);
      await page.keyboard.up('Shift');
      await expect(page.getByTestId('frame-selection')).toHaveCount(2, { timeout: 15_000 });
      const bodies = await page.getByTestId('frame-selection-body').evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height })));
      const near = (u: number, v: number) => Math.abs(u - v) < HOVER_TOLERANCE_PX;
      expect(bodies.some((r) => near(r.x, ghost.x) && near(r.y, ghost.y) && near(r.width, ghost.width) && near(r.height, ghost.height)), JSON.stringify({ ghost, bodies })).toBe(true);
      await expect(page.getByTestId('frame-align')).toHaveCount(1, { timeout: 15_000 });
      await shot(page, `${rotation}-align-bar`);
      await page.waitForTimeout(500);
      await page.getByTestId('frame-align').locator('[data-align="left"]').click();
      const sharesLeft = async () => {
        const all = await clips();
        const [ax, bx] = ['a', 'b'].map((id) => {
          const clip = all.find((c) => c.id === id)! as Clip & { transform?: { x?: number } };
          return Number(clip.props.x) + Number(clip.transform?.x ?? 0);
        });
        return Math.abs(ax - bx);
      };
      await expect.poll(async () => (await sharesLeft()) < ALIGN_TOLERANCE, { timeout: 30_000 }).toBe(true);
      await page.waitForTimeout(SETTLE_MS);
      await shot(page, `${rotation}-aligned`);
      await stays();
    });
  }
});
