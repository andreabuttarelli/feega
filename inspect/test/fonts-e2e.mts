import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPanel } from './harness.mts';

const FIXTURE = fileURLToPath(new URL('../../packages/source-map/fixtures/vite-react', import.meta.url));
const SHOTS = join(homedir(), 'Documents/feega-videos/fonts');
const MISSING = 'Zzyzx Display';
const REPLACEMENT = 'Space Grotesk';
const WARNING = `${MISSING} isn't installed or loaded. Text falls back to sans-serif.`;
const TIMEOUT_MS = 60_000;

const pricing = join(FIXTURE, 'src/Pricing.tsx');
const main = join(FIXTURE, 'src/main.tsx');
const sheet = join(FIXTURE, 'src/fonts.css');
const manifest = join(FIXTURE, 'package.json');
const originals = { pricing: readFileSync(pricing, 'utf8'), main: readFileSync(main, 'utf8'), manifest: readFileSync(manifest, 'utf8') };

writeFileSync(manifest, JSON.stringify({ ...JSON.parse(originals.manifest), scripts: { dev: 'vite' } }, null, 2));

writeFileSync(sheet, `h2 {\n  font-family: '${MISSING}', sans-serif;\n}\n`);
writeFileSync(main, `import './fonts.css';\n${originals.main}`);
writeFileSync(pricing, originals.pricing.replace('<button id="buy">', `<button id="buy" style={{ fontFamily: "'${MISSING}', serif" }}>`));
mkdirSync(SHOTS, { recursive: true });

const panel = await openPanel(FIXTURE);
const { page } = panel;

try {
  const notice = page.getByTestId('font-notice');
  await notice.waitFor({ timeout: TIMEOUT_MS });
  assert.ok((await notice.innerText()).includes(WARNING), 'the editor notice names the font and its fallback');
  await page.screenshot({ path: join(SHOTS, 'missing-font-notice.png') });

  await panel.pickAt('h2');
  const bar = page.locator('aside.right').getByTestId('missing-font');
  await bar.waitFor({ timeout: TIMEOUT_MS });
  assert.ok((await bar.innerText()).includes(WARNING), 'the Typography section warns about the font');
  const barBox = (await page.locator('aside.right').boundingBox())!;
  await page.screenshot({ path: join(SHOTS, 'missing-font-bar.png'), clip: { x: barBox.x, y: 0, width: barBox.width, height: Math.min(1800, barBox.height) } });

  await bar.locator('[data-action=replace-font]').click();
  await bar.locator('input').pressSequentially(REPLACEMENT);
  await page.locator('.font-item', { hasText: REPLACEMENT }).first().click();

  await page.waitForFunction(() => document.querySelector('[data-testid=font-notice]') === null, null, { timeout: TIMEOUT_MS });

  const css = readFileSync(sheet, 'utf8');
  assert.match(css, new RegExp(`^@import url\\("https://fonts.googleapis.com/css2\\?family=Space\\+Grotesk`), 'the Google font is loaded');
  assert.ok(css.includes(`font-family: '${REPLACEMENT}', sans-serif`), 'the stylesheet names the new font');
  assert.ok(readFileSync(pricing, 'utf8').includes(`fontFamily: "'${REPLACEMENT}', serif"`), 'the component names the new font');
  assert.ok(!css.includes(MISSING) && !readFileSync(pricing, 'utf8').includes(MISSING), 'the missing font is gone from the sources');
  console.log('FEEGA_FONTS_E2E_OK');
} catch (error) {
  await page.screenshot({ path: join(SHOTS, 'failure.png') });
  throw error;
} finally {
  writeFileSync(pricing, originals.pricing);
  writeFileSync(main, originals.main);
  writeFileSync(manifest, originals.manifest);
  rmSync(sheet, { force: true });
  await panel.close();
}
process.exit(0);
