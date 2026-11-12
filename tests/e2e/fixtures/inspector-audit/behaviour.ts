import { expect, type Locator, type Page } from '@playwright/test';
import { clipIn, docOf, inspector, layerShot, openSections, pick, press, reach, MIN_TARGET_PX, UNDO, type Clip } from './harness';
import { Check, Op, type Row } from './controls';

export type Outcome = { row: Row; mouse: Check[]; keyboard: Check[]; notes: string[] };

const COMMIT_MS = 6_000;
const POLL = { timeout: COMMIT_MS, intervals: [100, 200, 400] };
const MAX_TABS = 60;
const SETTLE_MS = 350;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function readNow(page: Page, row: Row): Promise<unknown> {
  const clip = clipIn(await docOf(page, row.node), row.layer);
  return clip ? row.read(clip as Clip) : undefined;
}

async function landed(page: Page, row: Row, before: unknown): Promise<boolean> {
  return expect
    .poll(async () => {
      const now = await readNow(page, row);
      return row.want(now, before);
    }, POLL)
    .toBe(true)
    .then(() => true)
    .catch(() => false);
}

async function restored(page: Page, row: Row, before: unknown): Promise<boolean> {
  return expect
    .poll(async () => same(await readNow(page, row), before), POLL)
    .toBe(true)
    .then(() => true)
    .catch(() => false);
}

async function leaveField(page: Page): Promise<void> {
  await press(page, inspector(page).getByTestId('selection-head'));
}

async function open(page: Page, row: Row): Promise<void> {
  await pick(page, row.node, row.layer);
  await openSections(page);
  for (const step of row.via ?? []) {
    await press(page, step(page));
    await page.waitForTimeout(SETTLE_MS);
  }
}

async function mouseDo(page: Page, row: Row, target: Locator): Promise<void> {
  const value = String(row.value ?? '');
  if (row.op === Op.Press) {
    await press(page, target);
    return;
  }
  if (row.op === Op.Menu) {
    await press(page, target);
    await page.waitForTimeout(SETTLE_MS);
    await press(page, page.getByRole('menuitem', { name: value, exact: true }));
    return;
  }
  if (row.op === Op.Select) {
    await press(page, target);
    await page.keyboard.press('Escape');
    await target.selectOption({ label: value });
    return;
  }
  if (row.op === Op.Scrub) {
    const label = target.locator('xpath=ancestor::*[@role="group"][1]').locator('.label');
    const box = (await label.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + Number(value), box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    return;
  }
  await press(page, target);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(value);
  await page.keyboard.press(row.op === Op.TypeTab ? 'Tab' : 'Enter');
}

async function tabTo(page: Page, from: Locator, target: Locator): Promise<boolean> {
  await from.focus();
  for (let i = 0; i < MAX_TABS; i++) {
    if (await target.evaluate((n) => document.activeElement === n).catch(() => false)) {
      return true;
    }
    await page.keyboard.press('Tab');
  }
  return false;
}

async function keyboardDo(page: Page, row: Row, target: Locator): Promise<void> {
  const value = String(row.value ?? '');
  const keys: Record<Op, () => Promise<void>> = {
    [Op.Press]: () => page.keyboard.press('Enter'),
    [Op.Menu]: async () => {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(SETTLE_MS);
      for (let i = 0; i < MAX_TABS; i++) {
        const name = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
        if (name === value) {
          break;
        }
        await page.keyboard.press('ArrowDown');
      }
      await page.keyboard.press('Enter');
    },
    [Op.Select]: () => page.keyboard.type(value.slice(0, 3)),
    [Op.Scrub]: () => page.keyboard.press('ArrowUp'),
    [Op.Arrow]: () => page.keyboard.press('ArrowUp'),
    [Op.ShiftArrow]: () => page.keyboard.press('Shift+ArrowUp'),
    [Op.Type]: async () => {
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type(value);
      await page.keyboard.press('Enter');
    },
    [Op.TypeTab]: async () => {
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type(value);
      await page.keyboard.press('Tab');
    }
  };
  await keys[row.op]();
}

async function attempt(page: Page, row: Row, act: (target: Locator) => Promise<void>, failed: Check[], shoot: (tag: string) => Promise<void>): Promise<void> {
  const before = await readNow(page, row);
  const pixels = row.canvas ? await layerShot(page) : null;
  await act(row.target(page));
  if (!(await landed(page, row, before))) {
    failed.push(Check.Commit);
    await shoot('commit');
    await leaveField(page).catch(() => undefined);
    return;
  }
  if (row.canvas) {
    await page.waitForTimeout(SETTLE_MS);
    const after = await layerShot(page);
    if (!pixels || !after || pixels.equals(after)) {
      failed.push(Check.Canvas);
      await shoot('canvas');
    }
  }
  await leaveField(page);
  await page.keyboard.press(UNDO);
  if (!(await restored(page, row, before))) {
    failed.push(Check.Undo);
    await shoot('undo');
  }
}

export async function exercise(page: Page, row: Row, shoot: (tag: string) => Promise<void>): Promise<Outcome> {
  const outcome: Outcome = { row, mouse: [], keyboard: [], notes: [] };
  await open(page, row);
  const target = row.target(page);
  if (!(await target.isVisible().catch(() => false))) {
    outcome.mouse.push(Check.Missing);
    outcome.keyboard.push(Check.Missing);
    await shoot('missing');
    return outcome;
  }

  const r = await reach(target);
  if (!r.hit) {
    outcome.mouse.push(Check.Reach);
    outcome.notes.push(`covered by ${r.coveredBy}`);
  }
  if (!r.name) {
    outcome.mouse.push(Check.Name);
  }
  if (Math.min(r.width, r.height) < MIN_TARGET_PX) {
    outcome.mouse.push(Check.Size);
    outcome.notes.push(`${Math.round(r.width)}×${Math.round(r.height)} px`);
  }
  await attempt(page, row, (t) => mouseDo(page, row, t), outcome.mouse, (tag) => shoot(`mouse-${tag}`));

  await pick(page, row.node, row.layer);
  await openSections(page);
  let from = inspector(page).locator('section[data-section] .section-head').first();
  for (const step of [...(row.via ?? []), row.target]) {
    if (!(await tabTo(page, from, step(page)))) {
      outcome.keyboard.push(Check.Reach);
      await shoot('keyboard-reach');
      return outcome;
    }
    if (step !== row.target) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(SETTLE_MS);
    }
    from = step(page);
  }
  await attempt(page, row, () => keyboardDo(page, row, row.target(page)), outcome.keyboard, (tag) => shoot(`keyboard-${tag}`));
  return outcome;
}
