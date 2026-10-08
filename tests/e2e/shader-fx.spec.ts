import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const ENTRY = fileURLToPath(new URL('./fixtures/shader-fx-entry.ts', import.meta.url));

const SOFTWARE_GL_BUDGET_MS = 60;
const COST_DRAWS = 30;

let bundle = '';

test.beforeAll(async () => {
  const out = await build({ entryPoints: [ENTRY], bundle: true, format: 'iife', write: false, target: 'es2020' });
  bundle = out.outputFiles[0].text;
});

test.beforeEach(async ({ page }) => {
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({ content: bundle });
});

const INVERT = 'vec4 effect(vec2 uv) { vec4 c = texture2D(u_src, uv); return vec4(1.0 - c.rgb, c.a); }';
const GRAIN = 'vec4 effect(vec2 uv) { vec4 c = texture2D(u_src, uv); return vec4(c.rgb * (0.5 + 0.5 * noise(uv * 40.0 + u_time)), 1.0); }';

test('compile returns problems for bad glsl', async ({ page }) => {
  const problems = await page.evaluate(() => window.shaderFxProbe.problemsOf('vec4 effect(vec2 uv) { return nope; }'));

  expect(problems.length).toBeGreaterThan(0);
});

test('a passthrough draw returns the input bytes', async ({ page }) => {
  const same = await page.evaluate(() => window.shaderFxProbe.passthroughMatches());

  expect(same).toBe(true);
});

test('a shader that fails to compile leaves the frame unchanged', async ({ page }) => {
  const same = await page.evaluate(() => window.shaderFxProbe.brokenMatches());

  expect(same).toBe(true);
});

test('read returns the drawn frame top-down, as ImageData holds it', async ({ page }) => {
  const same = await page.evaluate(() => window.shaderFxProbe.readMatches());

  expect(same).toBe(true);
});

test('an effect changes the pixels', async ({ page }) => {
  const changed = await page.evaluate((frag) => window.shaderFxProbe.changes(frag), INVERT);

  expect(changed).toBe(true);
});

test('the same effect at the same time and seed draws identical bytes', async ({ page }) => {
  const [a, b, later] = await page.evaluate((frag) => window.shaderFxProbe.hashes(frag, [1.5, 1.5, 2.5]), GRAIN);

  expect(a).toBe(b);
  expect(later).not.toBe(a);
});

test('measure reports cost and no problems for a clean effect, and flicker for a strobe', async ({ page }) => {
  const [clean, strobe, broken] = await page.evaluate(
    ([a, b]) => [window.shaderFxProbe.measure(a), window.shaderFxProbe.measure(b), window.shaderFxProbe.measure('vec4 effect(vec2 uv) { return nope; }')],
    [INVERT, 'vec4 effect(vec2 uv) { float on = mod(floor(u_time * 30.0), 2.0); return vec4(vec3(on), 1.0); }']
  );

  expect(clean.problems).toEqual([]);
  expect(clean.costMs).toBeGreaterThan(0);
  expect(strobe.flicker).toBeGreaterThan(0.5);
  expect(clean.flicker).toBeLessThan(0.05);
  expect(broken.problems.length).toBeGreaterThan(0);
});

test('a 1080p grain frame stays inside the software GL budget', async ({ page }) => {
  const { ms, renderer } = await page.evaluate(([frag, draws]) => window.shaderFxProbe.costMs(frag as string, draws as number), [GRAIN, COST_DRAWS] as const);
  test.info().annotations.push({ type: 'cost', description: `${ms.toFixed(2)} ms/frame on ${renderer}` });
  console.log(`shader-fx cost: ${ms.toFixed(2)} ms/frame on ${renderer}`);

  expect(ms).toBeLessThan(SOFTWARE_GL_BUDGET_MS);
});
