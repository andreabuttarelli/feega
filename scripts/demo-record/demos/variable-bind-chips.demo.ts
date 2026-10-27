import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { frameHost, heroDoc, openCanvas, seedFrame } from './seed';

const THEME = {
  Theme: {
    modes: ['Light', 'Dark'],
    vars: {
      surface: { type: 'colour', values: { Light: '#f6f1ea', Dark: '#14110e' } },
      ink: { type: 'colour', values: { Light: '#1d1a16', Dark: '#f6f1ea' } },
      accent: { type: 'colour', values: { Light: '#1d1a16', Dark: '#e8a35c' } }
    }
  }
};

const BINDINGS = [
  { layer: 'Select Shape · page', target: 'fill', variable: 'Theme/surface' },
  { layer: 'Select Shape · cta', target: 'fill', variable: 'Theme/accent' },
  { layer: 'Mornings, made slower.', target: 'color', variable: 'Theme/ink' },
  { layer: 'Shop the set · €48', target: 'color', variable: 'Theme/surface' }
];

test('variable bind chips', async ({ page, session, admin, seedNode }) => {
  const doc = { ...heroDoc(), variables: THEME };
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, doc);
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, id).boundingBox())!;

  await recordDemo(page, { slug: 'variable-bind-chips', title: 'bind variables with one click' }, async (d) => {
    await d.click({ x: box.x + 6, y: box.y + 6 });
    await d.wait(1500);
    for (const { layer, target, variable } of BINDINGS) {
      await d.click(layer.startsWith('Select') ? page.getByRole('button', { name: layer }) : page.getByText(layer, { exact: true }).first());
      const chip = page.getByTestId(`bind-chip-${target}`);
      await expect(chip).toBeVisible({ timeout: 15_000 });
      await d.click(chip);
      await d.click(page.getByTestId(`bind-option-${variable}`));
      await expect(page.getByTestId(`bind-chip-${target}`)).toHaveAttribute('data-bound', variable);
      await d.wait(900);
    }
    await d.key('Escape');
    await d.wait(1000);
    await d.select(page.getByTestId('variable-mode-Theme'), 'Dark', box);
    await d.wait(1800);
    await d.select(page.getByTestId('variable-mode-Theme'), 'Light', box);
    await d.wait(1200);
  });
});
