import type { Page } from '@playwright/test';
import { MIN_TARGET_PX, inspector, openSections, pick, press, reach } from './harness';

export enum Problem {
  Covered = 'covered',
  Unnamed = 'unnamed',
  Small = 'small',
  Untabbable = 'untabbable',
  OpensNothing = 'opens-nothing',
  EscapeIgnored = 'escape-ignored',
  EscapeDeselects = 'escape-deselects',
  FocusLost = 'focus-lost'
}

export type Finding = { layer: string; section: string; control: string; problem: Problem; detail: string };

const CONTROLS = 'button, input, select, textarea, [role="button"], [role="slider"], [role="switch"], [role="menuitem"], [role="option"], [role="radio"], [role="combobox"], [tabindex]:not([tabindex="-1"])';
const POPUPS = '[data-testid="side-popover"], [role="menu"], [role="listbox"], [role="dialog"]';
const TRIGGERS = '[aria-expanded]:not(.section-head), [aria-haspopup]';
const OPEN_MS = 300;

async function controlsIn(page: Page, scope: string, layer: string, within: string): Promise<Finding[]> {
  const all = page.locator(scope).locator(CONTROLS);
  const found: Finding[] = [];
  const count = await all.count();
  console.log(`  ${layer} ${within || 'inspector'}: ${count} controls`);
  for (let i = 0; i < count; i++) {
    const el = all.nth(i);
    if (!(await el.isVisible().catch(() => false))) {
      continue;
    }
    const [section, key] = await el.evaluate((n: HTMLElement) => [n.closest('[data-section]')?.getAttribute('data-section') ?? '', n.getAttribute('data-testid') ?? n.getAttribute('aria-label') ?? n.getAttribute('title') ?? `${n.tagName.toLowerCase()}:${(n.textContent ?? '').trim().slice(0, 24)}`]);
    const r = await reach(el);
    const control = within ? `${within} > ${key}` : key;
    const where = within ? 'popup' : section;
    if (!r.hit) {
      found.push({ layer, section: where, control, problem: Problem.Covered, detail: `centre lands on ${r.coveredBy}` });
    }
    if (!r.name) {
      found.push({ layer, section: where, control, problem: Problem.Unnamed, detail: 'no accessible name' });
    }
    if (Math.min(r.width, r.height) < MIN_TARGET_PX && !r.disabled) {
      found.push({ layer, section: where, control, problem: Problem.Small, detail: `${Math.round(r.width)}×${Math.round(r.height)} px` });
    }
    if (!r.tabbable && !r.disabled && !(await el.evaluate((n) => ['menuitem', 'option', 'radio'].includes(n.getAttribute('role') ?? '')))) {
      found.push({ layer, section: where, control, problem: Problem.Untabbable, detail: 'not in the tab order' });
    }
  }
  return found;
}

type Trigger = { key: string; css: string; nth: number };

async function triggersIn(page: Page): Promise<Trigger[]> {
  return inspector(page)
    .locator(TRIGGERS)
    .evaluateAll((els) => {
      const seen = new Map<string, number>();
      return els.map((n) => {
        const section = n.closest('[data-section]')?.getAttribute('data-section') ?? '';
        const id = n.getAttribute('data-testid');
        const label = n.getAttribute('aria-label');
        const own = id ? `[data-testid="${id}"]` : label ? `[aria-label="${label.replaceAll('"', '\\"')}"]` : n.tagName.toLowerCase();
        const css = section ? `section[data-section="${section}"] ${own}` : own;
        const nth = seen.get(css) ?? 0;
        seen.set(css, nth + 1);
        return { key: `${section}:${id ?? label ?? n.tagName.toLowerCase()}`, css, nth };
      });
    });
}

async function popupsFrom(page: Page, node: string, layer: string): Promise<Finding[]> {
  const found: Finding[] = [];
  const triggers = await triggersIn(page);
  const popup = page.locator(POPUPS);

  for (const { key, css, nth } of triggers) {
    const trigger = inspector(page).locator(css).nth(nth);
    if (!(await trigger.isVisible().catch(() => false))) {
      console.log(`  ${layer} trigger ${key} not visible`);
      continue;
    }
    const [section, control] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
    console.log(`  ${layer} trigger ${key}`);
    await press(page, trigger);
    await page.waitForTimeout(OPEN_MS);
    if ((await popup.count()) === 0) {
      found.push({ layer, section, control, problem: Problem.OpensNothing, detail: 'a click shows no menu, list or popover' });
      continue;
    }
    found.push(...(await controlsIn(page, POPUPS, layer, control)));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(OPEN_MS);
    if (!(await inspector(page).isVisible())) {
      found.push({ layer, section, control, problem: Problem.EscapeDeselects, detail: 'Escape in the popup also deselects the layer' });
      await pick(page, node, layer);
      await openSections(page);
      continue;
    }
    if ((await popup.count()) > 0) {
      found.push({ layer, section, control, problem: Problem.EscapeIgnored, detail: 'Escape leaves the popup open' });
      await press(page, trigger);
      continue;
    }
    const focused = await trigger.evaluate((n) => document.activeElement === n).catch(() => false);
    if (!focused) {
      found.push({ layer, section, control, problem: Problem.FocusLost, detail: 'focus does not return to the trigger after Escape' });
    }
  }
  return found;
}

export async function sweepLayer(page: Page, node: string, layer: string): Promise<Finding[]> {
  await pick(page, node, layer);
  await openSections(page);
  return [...(await controlsIn(page, '[data-testid="motion-inspector"]', layer, '')), ...(await popupsFrom(page, node, layer))];
}
