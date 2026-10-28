import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { exportCode, CodeTarget } from '@feega/motion-core/motion/codegen/index';
import { landingDoc, LANDING_ASSETS } from '@feega/motion-core/motion/codegen/fixtures/landing';
import { addBreakpoint, BreakpointPreset, resolveAt, viewsOf } from '@feega/motion-core/motion/breakpoints/model';

const OUT = join(homedir(), 'Documents/feega-videos/breakpoints');
const SHOT_HEIGHT = 1800;
const GAP = 80;
const PAPER = '#eceef1';

const withPreset = (d: MotionDoc, preset: BreakpointPreset) => {
  const r = addBreakpoint(d, preset, preset);
  return r.ok ? r.doc : d;
};
const fixture = landingDoc();
const doc = fixture.breakpoints?.length ? fixture : withPreset(withPreset(fixture, BreakpointPreset.Tablet), BreakpointPreset.Phone);
const views = viewsOf(doc);
const browser = await chromium.launch();
const shots: { file: string; width: number }[] = [];

for (const view of views) {
  const dir = join(OUT, 'site', view.id);
  for (const file of exportCode(resolveAt(doc, view.id), { target: CodeTarget.Html, name: 'Ledgerline', assets: LANDING_ASSETS }).files) {
    mkdirSync(dirname(join(dir, file.path)), { recursive: true });
    writeFileSync(join(dir, file.path), file.content);
  }
  const page = await browser.newPage({ viewport: { width: view.width, height: SHOT_HEIGHT } });
  await page.goto(`file://${join(dir, 'index.html')}`);
  await page.waitForTimeout(500);
  const file = join(OUT, `${view.id}.png`);
  await page.screenshot({ path: file });
  shots.push({ file, width: view.width });
  await page.close();
}
await browser.close();

const width = shots.reduce((w, s) => w + s.width + GAP, GAP);
await sharp({ create: { width, height: SHOT_HEIGHT + GAP * 2, channels: 4, background: PAPER } })
  .composite(shots.map((s, i) => ({ input: s.file, left: GAP + shots.slice(0, i).reduce((w, p) => w + p.width + GAP, 0), top: GAP })))
  .png()
  .toFile(join(OUT, 'views.png'));
console.log(join(OUT, 'views.png'));
