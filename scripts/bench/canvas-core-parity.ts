import sharp from 'sharp';
import { chromium, type Page } from '@playwright/test';
import heavy from '../../tests/e2e/fixtures/heavy-canvas-landings.json' with { type: 'json' };

const BASE = process.env.BENCH_BASE_URL ?? 'http://localhost:5173';
const OUT = process.env.BENCH_OUT ?? '.';
const SETTLE_MS = 12_000;
const STEP_MS = 2500;
const OFF = 8;
const ZOOMS_IN = [4, 10];
const CANVAS_AREA = { x: 44, y: 48, width: 1116, height: 852 };

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function zoomOnto(page: Page, nodeId: string, steps: number) {
  const node = page.locator(`.svelte-flow__node[data-id="${nodeId}"]`);
  for (let i = 0; i < steps; i++) {
    const box = (await node.boundingBox())!;
    const at = { x: box.x + box.width / 2, y: Math.min(box.y + box.height / 2, 600) };
    await page.evaluate(`document.elementFromPoint(${at.x}, ${at.y})?.dispatchEvent(new WheelEvent('wheel', { clientX: ${at.x}, clientY: ${at.y}, deltaY: -60, ctrlKey: true, bubbles: true, cancelable: true }))`);
    await page.waitForTimeout(120);
  }
}

type Shot = { name: string; file: string };

async function shots(renderer: string): Promise<Shot[]> {
  const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-angle=metal'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' })).newPage();
  await login(page);
  const url = `${BASE}/p/${heavy.projectId}/c/${heavy.canvasId}${renderer ? `?renderer=${renderer}` : ''}`;
  const taken: Shot[] = [];
  const take = async (name: string) => {
    await page.locator('[data-revealed="true"]').first().waitFor({ timeout: 90_000 });
    await page.waitForTimeout(STEP_MS);
    const file = `${OUT}/parity-${name}-${renderer || 'gpu'}.png`;
    const full = await page.screenshot({ timeout: 120_000 });
    await sharp(full).extract({ left: CANVAS_AREA.x, top: CANVAS_AREA.y, width: CANVAS_AREA.width, height: CANVAS_AREA.height }).toFile(file);
    taken.push({ name, file });
  };
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(SETTLE_MS);
  await take('fit');
  for (const landing of (process.env.PARITY_NODES ? process.env.PARITY_NODES.split(',').map((id) => ({ key: id.slice(0, 8), desktop: { nodeId: id } })) : heavy.landings)) {
    for (const steps of ZOOMS_IN) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 });
      await page.waitForTimeout(SETTLE_MS / 2);
      await zoomOnto(page, landing.desktop.nodeId, steps);
      await take(`${landing.key}-z${steps}`);
    }
  }
  await browser.close();
  return taken;
}

async function offShare(a: string, b: string): Promise<number> {
  const [x, y] = await Promise.all([a, b].map((f) => sharp(f).removeAlpha().raw().toBuffer()));
  let off = 0;
  for (let i = 0; i < x.length; i += 3) {
    if (Math.max(Math.abs(x[i] - y[i]), Math.abs(x[i + 1] - y[i + 1]), Math.abs(x[i + 2] - y[i + 2])) > OFF) {
      off++;
    }
  }
  return off / (x.length / 3);
}

const gpu = await shots('');
const core = await shots('core');
for (const [i, s] of gpu.entries()) {
  console.log(`${s.name}\t${(100 * (await offShare(s.file, core[i].file))).toFixed(2)}% pixels off by >${OFF}/255`);
}
