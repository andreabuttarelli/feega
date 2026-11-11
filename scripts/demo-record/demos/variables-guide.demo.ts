import type { Page } from '@playwright/test';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import type { Demo } from '../demo';
import { frameHost, heroDoc, openCanvas, seedFrame } from './seed';

const COLLECTION = 'Theme';
const DARK = 'Dark';
const LIGHT = 'Default';
const HEADLINE = 'Mornings, made slower.';
const CTA_LABEL = 'Shop the set · €48';
const EDGE = 6;
const DWELL_MS = 1800;

type Variable = { name: string; type: 'colour' | 'number' | 'string'; light: string; dark: string };

const VARIABLES: Variable[] = [
  { name: 'surface', type: 'colour', light: '#f6f1ea', dark: '#14110e' },
  { name: 'ink', type: 'colour', light: '#1d1a16', dark: '#f6f1ea' },
  { name: 'radius', type: 'number', light: '0', dark: '24' },
  { name: 'headline', type: 'string', light: HEADLINE, dark: 'Evenings, made slower.' }
];

const BINDINGS = [
  { layer: 'Select Shape · page', target: 'fill', variable: `${COLLECTION}/surface` },
  { layer: 'Select Shape · cta', target: 'fill', variable: `${COLLECTION}/ink` },
  { layer: 'Select Shape · cta', target: 'radius', variable: `${COLLECTION}/radius` },
  { layer: HEADLINE, target: 'color', variable: `${COLLECTION}/ink` },
  { layer: HEADLINE, target: 'text', variable: `${COLLECTION}/headline` },
  { layer: CTA_LABEL, target: 'color', variable: `${COLLECTION}/surface` }
];

const valueTestId = (variable: string, mode: string) => `variable-value-${COLLECTION}-${variable}-${mode}`;

async function setColour(page: Page, d: Demo, variable: string, mode: string, hex: string) {
  await d.click(page.getByTestId(valueTestId(variable, mode)).getByRole('button'));
  const field = page.getByTestId('colour-popover').locator('input[type="text"]').first();
  await expect(field).toBeVisible({ timeout: 15_000 });
  await field.fill(hex);
  await field.press('Enter');
  await d.key('Escape');
}

test('variables guide', async ({ page, session, admin, seedNode }) => {
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, heroDoc());
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, id).boundingBox())!;
  const frameEdge = { x: box.x + EDGE, y: box.y + EDGE };
  const modeMenu = page.getByTestId(`variable-mode-${COLLECTION}`);

  await recordDemo(page, { slug: 'variables-guide', title: 'variables and modes, start to finish' }, async (d) => {
    await d.click(frameEdge);
    await d.click(page.getByText('Frame settings'));
    await expect(page.getByTestId('variables-library')).toBeVisible({ timeout: 15_000 });

    await d.type(page.getByTestId('variable-new-collection'), COLLECTION);
    for (const v of VARIABLES) {
      await d.type(page.getByTestId('variable-new-name'), v.name);
      await d.select(page.getByTestId('variable-new-type'), v.type);
      await d.click(page.getByTestId('variable-add-button'));
      await expect(page.getByTestId('variable-row').filter({ hasText: v.name })).toBeVisible();
    }

    await d.type(page.getByTestId(`variable-new-mode-${COLLECTION}`), DARK);
    await d.click(page.getByTestId(`variable-add-mode-${COLLECTION}`));
    await expect(modeMenu.locator(`option[value="${DARK}"]`)).toHaveCount(1);

    for (const v of VARIABLES) {
      for (const [mode, value] of [[LIGHT, v.light], [DARK, v.dark]] as const) {
        if (v.type === 'colour') {
          await setColour(page, d, v.name, mode, value);
          continue;
        }
        const input = page.getByTestId(valueTestId(v.name, mode));
        await d.type(input, value);
        await input.press('Tab');
      }
    }

    for (const { layer, target, variable } of BINDINGS) {
      await d.click(layer.startsWith('Select') ? page.getByRole('button', { name: layer }) : page.getByText(layer, { exact: true }).first());
      const chip = page.getByTestId(`bind-chip-${target}`);
      await expect(chip).toBeVisible({ timeout: 15_000 });
      await d.click(chip);
      await d.click(page.getByTestId(`bind-option-${variable}`));
      await expect(page.getByTestId(`bind-chip-${target}`)).toHaveAttribute('data-bound', variable);
      await d.wait(700);
    }
    await d.key('Escape');

    await d.click(frameEdge);
    await d.select(modeMenu, DARK, box);
    await d.wait(DWELL_MS);

    await setColour(page, d, 'ink', DARK, '#e8a35c');
    await d.wait(DWELL_MS);
    await d.select(modeMenu, LIGHT, box);
    await d.wait(DWELL_MS);
  });
});
