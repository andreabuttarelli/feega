import { test, expect, type Page } from '@playwright/test';
import { MotionFormat } from '../../src/lib/motion/doc';
import { ShotId } from '../../src/lib/motion/shots/library';
import { VectorKind, VectorRole, type VectorUi } from '../../src/lib/motion/vector-ui/model';
import type { ShotCase } from './fixtures/shot-probe';

const HOST_PAGE = '/changelog';
const PROBE = '/tests/e2e/fixtures/shot-probe.ts';
const RENDER_TIMEOUT_MS = 600_000;
const SEEK_RUNS = 3;

const UI: VectorUi = {
  url: 'https://feega.test/app',
  title: 'feega',
  width: 1280,
  height: 800,
  background: 'rgb(250, 250, 248)',
  fonts: ['DM Sans'],
  raster: [],
  nodes: [
    { id: 'heading-0', role: VectorRole.Heading, kind: VectorKind.Text, x: 576, y: 185, w: 348, h: 75, text: 'make a video.', size: 64, color: 'rgb(0, 0, 0)', font: 'DM Sans' },
    { id: 'input-0', role: VectorRole.Input, kind: VectorKind.Box, x: 407, y: 307, w: 686, h: 56, fill: 'rgb(255, 255, 255)', stroke: '1px solid rgb(229, 229, 229)' },
    { id: 'input-1', role: VectorRole.Input, kind: VectorKind.Text, x: 420, y: 325, w: 300, h: 18, text: 'Paste your website', size: 15, color: 'rgb(140, 140, 140)' },
    { id: 'button-0', role: VectorRole.Button, kind: VectorKind.Box, x: 1053, y: 371, w: 40, h: 40, fill: 'rgb(0, 153, 255)', r: '9999px' },
    { id: 'button-1', role: VectorRole.Button, kind: VectorKind.Box, x: 599, y: 440, w: 99, h: 32, stroke: '1px solid rgb(229, 229, 229)' }
  ]
};

const SLOTS: Record<ShotId, Record<string, unknown>> = {
  [ShotId.KineticTitle]: { text: 'Your brand sits still.' },
  [ShotId.DeviceFlyIn]: {},
  [ShotId.UiFocus]: { field_id: 'input-0', button_id: 'button-0', type_text: 'a launch film' },
  [ShotId.FeatureGrid]: { items: 'Launch films|Product demos|Social ads' },
  [ShotId.StatCount]: { value: '125+', label: 'payment methods' },
  [ShotId.BeforeAfter]: { before_text: 'three weeks in a timeline' },
  [ShotId.LogoResolve]: { wordmark: 'feega', url: 'feega.app' },
  [ShotId.UiMorph]: { from_id: 'input-0', to_id: 'button-0' },
  [ShotId.TaglineCard]: { lines: 'make your brand|move.' },
  [ShotId.WhipZoom]: { target_id: 'button-0' }
};

const FORMATS = [MotionFormat.Vertical, MotionFormat.Landscape];

async function probe(page: Page) {
  await page.setViewportSize({ width: 1920, height: 1920 });
  await page.goto(HOST_PAGE);
  await page.evaluate((path) => import(path), PROBE);
}

test.describe('every shot of the library, rendered in a real browser', () => {
  test.setTimeout(RENDER_TIMEOUT_MS);

  for (const format of FORMATS) {
    for (const shot of Object.values(ShotId)) {
      const c: ShotCase = { format, shot, slots: SLOTS[shot], ui: UI };

      test(`${shot} ${format} exports without a frame jump`, async ({ page }) => {
        await probe(page);

        const measured = await page.evaluate((x) => window.shotProbe.jolts(x), c);

        expect(measured.jolts, `frame diffs: ${measured.diffs.join(',')}`).toEqual([]);
      });
    }
  }

  test('stat-count draws the same frame for a time whatever time came before', async ({ page }) => {
    await probe(page);

    for (let run = 0; run < SEEK_RUNS; run++) {
      const problems = await page.evaluate((x) => window.shotProbe.seekCheck(x), { format: MotionFormat.Vertical, shot: ShotId.StatCount, slots: SLOTS[ShotId.StatCount], ui: UI });
      expect(problems).toEqual([]);
    }
  });
});
