import { execFileSync } from 'node:child_process';
import { existsSync, symlinkSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPanel, type Panel } from '../harness.mts';
import { ToView, type ChangeRow } from '../../src/messages.ts';
import { PAGES, Stack, type Page } from './pages.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const APPS = join(HERE, 'apps');
const FIXTURES = resolve(HERE, '../fixtures');
const RAW = process.env.RAW ?? join(homedir(), 'Documents/feega-videos/editor-shots/v2');
const OUT = process.env.OUT;
const ONLY = process.env.ONLY?.split(',');
const SETTLE_MS = 3500;
const SHORT_MS = 500;
const WEBP_QUALITY = '82';
const VIEWPORT = { width: 1440, height: 900 };
const HEADING = 'h1';
const BUTTON = '.fl-btn--primary';
const HERO_BUTTON = '.fl-hero-product .fl-btn--primary';
const SHOP_BUTTON = '.fl-hero-split .fl-btn--primary';
const CHANGED_FILE = 'index.html';
const RADIUS_ROW = 'radius';
const RADIUS_VALUE = '12';

enum Step {
  Select = 'select',
  Radius = 'radius',
  Changes = 'changes',
  HideLayers = 'hide-layers',
  Menu = 'menu',
  Tablet = 'tablet',
  Phone = 'phone'
}

type Clip = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

type Shot = {
  readonly id: string;
  readonly page: string;
  readonly target: string;
  readonly steps: readonly Step[];
  readonly crop: { readonly name: string; readonly clip: Clip } | null;
};

const PROPERTIES: Clip = { x: 1140, y: 0, width: 300, height: 710 };
const SOURCE_LINE: Clip = { x: 1140, y: 0, width: 300, height: 220 };

const SHOTS: readonly Shot[] = [
  { id: 'overview', page: 'saas', target: HERO_BUTTON, steps: [Step.Select], crop: { name: 'crop-overview', clip: PROPERTIES } },
  { id: 'selected', page: 'portfolio', target: HEADING, steps: [Step.Select], crop: { name: 'crop-selected', clip: PROPERTIES } },
  { id: 'changes', page: 'shop', target: SHOP_BUTTON, steps: [Step.Select, Step.Radius, Step.HideLayers, Step.Changes], crop: { name: 'crop-changes', clip: { x: 1140, y: 0, width: 300, height: 165 } } },
  { id: 'layers-menu', page: 'dashboard', target: 'h1, h2', steps: [Step.Select, Step.Menu], crop: { name: 'crop-layers-menu', clip: { x: 0, y: 0, width: 0, height: 0 } } },
  { id: 'tablet', page: 'blog', target: HEADING, steps: [Step.Select, Step.Tablet], crop: { name: 'crop-responsive', clip: { x: 380, y: 40, width: 644, height: 725 } } },
  { id: 'phone', page: 'login', target: 'h1, h2', steps: [Step.Phone, Step.Select], crop: null },
  { id: 'react', page: 'agency', target: HEADING, steps: [Step.Select], crop: { name: 'crop-react', clip: SOURCE_LINE } },
  { id: 'vue', page: 'docs', target: 'h2', steps: [Step.Select], crop: { name: 'crop-vue', clip: SOURCE_LINE } },
  { id: 'sveltekit', page: 'event', target: HEADING, steps: [Step.Select], crop: { name: 'crop-sveltekit', clip: SOURCE_LINE } },
  { id: 'nuxt', page: 'cafe', target: 'h2', steps: [Step.Select], crop: { name: 'crop-nuxt', clip: SOURCE_LINE } }
];

const MENU_CROP = { width: 360, height: 215, left: 110, above: 40 };

function ensureDeps(page: Page) {
  const root = join(APPS, page.id);
  if (page.stack === Stack.Nuxt) {
    if (!existsSync(join(root, 'node_modules'))) {
      execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
    }
    return;
  }
  const link = join(APPS, 'node_modules');
  if (!existsSync(link)) {
    symlinkSync(join(FIXTURES, 'node_modules'), link);
  }
}

const STEPS: Record<Step, (panel: Panel, shot: Shot) => Promise<void>> = {
  [Step.Select]: async (panel, shot) => {
    await panel.pickAt(shot.target);
    await panel.page.waitForTimeout(SHORT_MS);
  },
  [Step.Radius]: async (panel) => {
    await panel.reply({ kind: ToView.Change, row: RADIUS_ROW, value: RADIUS_VALUE });
    await panel.page.waitForTimeout(SETTLE_MS);
  },
  [Step.HideLayers]: async (panel) => {
    await panel.page.getByTestId('left-toggle').click();
    await panel.page.waitForTimeout(SHORT_MS);
  },
  [Step.Changes]: async (panel) => {
    const row: ChangeRow = { id: 1, at: CHANGED_FILE, prop: 'border-radius', value: `${RADIUS_VALUE}px`, scope: 'This element', files: [CHANGED_FILE], time: Date.now() };
    await panel.reply({ kind: ToView.History, changes: [row], canUndo: true, canRedo: false });
    await panel.page.getByTestId('changes-tab').click();
    await panel.page.waitForTimeout(SHORT_MS);
  },
  [Step.Menu]: async (panel) => {
    const row = panel.page.locator('[data-layer][aria-selected=true]').first();
    await row.click({ button: 'right', position: { x: 60, y: 10 } });
    await panel.page.locator('[data-testid=structure-menu]').waitFor();
  },
  [Step.Tablet]: async (panel) => {
    await panel.page.mouse.move(5, 5);
    await panel.page.keyboard.press('3');
    await panel.page.waitForTimeout(SETTLE_MS);
  },
  [Step.Phone]: async (panel) => {
    await panel.page.mouse.move(5, 5);
    await panel.page.keyboard.press('4');
    await panel.page.waitForTimeout(SETTLE_MS);
  }
};

function toWebp(png: string, webp: string) {
  execFileSync('cwebp', ['-quiet', '-q', WEBP_QUALITY, png, '-o', webp]);
}

async function capture(shot: Shot, page: Page) {
  ensureDeps(page);
  const panel = await openPanel(join(APPS, page.id));
  await panel.page.setViewportSize(VIEWPORT);
  await panel.page.waitForTimeout(SETTLE_MS);

  for (const step of shot.steps) {
    await STEPS[step](panel, shot);
  }
  await panel.page.waitForTimeout(SHORT_MS);

  const png = join(RAW, `${shot.id}.png`);
  await panel.page.screenshot({ path: png });
  const files = [`${shot.id}.webp`];
  if (OUT) {
    toWebp(png, join(OUT, `${shot.id}.webp`));
  }

  if (shot.crop) {
    const clip = shot.id === 'layers-menu' ? await menuClip(panel) : shot.crop.clip;
    const cropPng = join(RAW, `${shot.crop.name}.png`);
    await panel.page.screenshot({ path: cropPng, clip });
    files.push(`${shot.crop.name}.webp`);
    if (OUT) {
      toWebp(cropPng, join(OUT, `${shot.crop.name}.webp`));
    }
  }

  for (const _ of panel.saves) {
    await panel.edits.undo();
  }
  await panel.close();
  return files;
}

async function menuClip(panel: Panel): Promise<Clip> {
  const box = (await panel.page.locator('[data-testid=structure-menu]').boundingBox())!;
  const x = Math.max(0, box.x - MENU_CROP.left);
  const y = Math.max(0, box.y - MENU_CROP.above);
  return { x, y, width: MENU_CROP.width, height: MENU_CROP.height };
}

await mkdir(RAW, { recursive: true });
if (OUT) {
  await mkdir(OUT, { recursive: true });
}

const manifest: Record<string, { page: string; files: string[] }> = {};
for (const shot of SHOTS.filter((s) => !ONLY || ONLY.includes(s.id))) {
  const page = PAGES.find((p) => p.id === shot.page)!;
  manifest[shot.id] = { page: page.id, files: await capture(shot, page) };
  console.log('captured', shot.id, page.id);
}

if (OUT && !ONLY) {
  await writeFile(join(OUT, 'manifest.json'), JSON.stringify({ shots: manifest }, null, 2) + '\n');
}
process.exit(0);
