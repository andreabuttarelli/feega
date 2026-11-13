import { expect, type Locator, type Page } from '@playwright/test';
import { clipIn, docOf, inspector, layerShot, openSections, pick, press, reach, reveal, MIN_TARGET_PX, UNDO, type Clip } from './harness';
import { Layer } from './fixture';
import { Check, Op, State, type Row } from './controls';

export type Outcome = { row: Row; mouse: Check[]; keyboard: Check[]; notes: string[] };

const COMMIT_MS = 6_000;
const POLL = { timeout: COMMIT_MS, intervals: [100, 200, 400] };
const MAX_TABS = 200;
const CANVAS_MS = 2_000;
const SETTLE_SHOTS = 8;
const TOGGLES = new Set(['checkbox', 'switch']);
const SETTLE_MS = 350;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const started = Date.now();
const trace = (...parts: unknown[]) => process.env.INSPECTOR_AUDIT_TRACE && console.log(`  [${((Date.now() - started) / 1000).toFixed(1)}s]`, ...parts);
const FOCUS_MS = 2_000;
const SHORT_MS = 3_000;
const PICK_MS = 1_500;
const MAX_RADIOS = 8;
const PICK_RETRY_MS = 30_000;

async function focused(target: Locator): Promise<boolean> {
  return expect
    .poll(() => target.evaluate((n) => document.activeElement === n).catch(() => false), { timeout: FOCUS_MS })
    .toBe(true)
    .then(() => true)
    .catch(() => false);
}

const isFocused = (target: Locator) => target.evaluate((n) => document.activeElement === n);

async function focusByMouse(page: Page, target: Locator): Promise<void> {
  for (let tries = 0; tries < 2; tries++) {
    await press(page, target);
    if (await focused(target)) {
      return;
    }
  }
  throw new Error('a click on the field does not focus it');
}

async function readNow(page: Page, row: Row): Promise<unknown> {
  if (row.local) {
    return row.local(page);
  }
  const doc = await docOf(page, row.node);
  if (row.whole) {
    return row.whole(doc);
  }
  const read = (id: string) => {
    const clip = clipIn(doc, id);
    return clip ? row.read(clip as Clip) : undefined;
  };
  return row.with ? [row.layer, ...row.with].map(read) : read(row.layer);
}

export type Selection = Pick<Row, 'node' | 'layer' | 'state' | 'with'>;

export async function select(page: Page, row: Selection): Promise<void> {
  const first = row.state === State.Frame ? Layer.MixA : row.layer;
  await pick(page, row.node, first);
  for (const other of row.with ?? []) {
    await expect(async () => {
      await reveal(page, other);
      await page.getByTestId('layers').locator(`[data-layer="${other}"]`).click({ modifiers: ['Shift'], timeout: SHORT_MS });
      await expect(page.getByTestId('multi-inspector')).toBeVisible({ timeout: SHORT_MS });
    }).toPass({ timeout: PICK_RETRY_MS });
  }
  if (row.state === State.Frame) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Escape');
    await page.getByTestId('frame-look').waitFor({ timeout: SHORT_MS });
  }
  if (row.with) {
    await page.getByTestId('multi-inspector').waitFor({ timeout: SHORT_MS });
  }
}

async function holds(page: Page, row: Row): Promise<boolean> {
  if (row.with) {
    return page.getByTestId('multi-inspector').isVisible();
  }
  if (row.state === State.Frame) {
    return page.getByTestId('frame-look').isVisible();
  }
  const head = await inspector(page).getByTestId('selection-head').getAttribute('title', { timeout: SHORT_MS }).catch(() => null);
  return head === row.layer;
}

const startOf = (page: Page): Locator => page.getByTestId('frame-inspector').locator('button, input, select, textarea, [tabindex="0"]').first();

async function shownValue(target: Locator): Promise<string> {
  return target.evaluate((n) => {
    if (n instanceof HTMLSelectElement) {
      return n.selectedOptions[0]?.textContent?.trim() ?? '';
    }
    const input = n as HTMLInputElement;
    return `${input.value ?? ''}${input.indeterminate ? 'Mixed' : ''}|${input.placeholder ?? ''}`;
  });
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
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

async function open(page: Page, row: Row): Promise<void> {
  await select(page, row);
  await openSections(page);
  await row.prep?.(page);
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
    await target.selectOption({ label: value });
    return;
  }
  if (ARROW_KEY[row.op]) {
    await focusByMouse(page, target);
    await page.keyboard.press(ARROW_KEY[row.op]!);
    return;
  }
  if (row.op === Op.Pick) {
    await focusByMouse(page, target);
    await page.keyboard.type(value);
    await page.waitForTimeout(PICK_MS);
    await press(page, page.getByRole('button', { name: value, exact: true }).first());
    return;
  }
  if (row.op === Op.Drag) {
    const box = (await target.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.15);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6, { steps: 10 });
    await page.mouse.up();
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
  await focusByMouse(page, target);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(value);
  await page.keyboard.press(row.op === Op.TypeTab ? 'Tab' : 'Enter');
}

const ARROW_KEY: Partial<Record<Op, string>> = { [Op.Arrow]: 'ArrowUp', [Op.ShiftArrow]: 'Shift+ArrowUp', [Op.ArrowDown]: 'ArrowDown' };

export enum Reached {
  Yes = 'yes',
  LeftLayer = 'tab-selected-another-layer',
  Never = 'never'
}

const atStop = (n: Element) => {
  const active = document.activeElement;
  if (active === n) {
    return true;
  }
  const group = n.getAttribute('role') === 'radio' ? n.closest('[role="radiogroup"]') : null;
  return !!group && active?.getAttribute('role') === 'radio' && group.contains(active);
};

async function tabTo(page: Page, from: Locator | null, target: Locator, row: Row): Promise<Reached> {
  const goal = await target.elementHandle({ timeout: SHORT_MS }).catch(() => null);
  if (!goal) {
    return Reached.Never;
  }
  if (from) {
    await from.focus({ timeout: SHORT_MS }).catch(() => undefined);
  }
  for (let i = 0; i < MAX_TABS; i++) {
    if (await goal.evaluate(atStop).catch(() => false)) {
      return Reached.Yes;
    }
    await page.keyboard.press('Tab');
    if (!(await holds(page, row))) {
      return Reached.LeftLayer;
    }
  }
  return Reached.Never;
}

async function keyboardDo(page: Page, row: Row, target: Locator): Promise<void> {
  const value = String(row.value ?? '');
  const keys: Record<Op, () => Promise<void>> = {
    [Op.Press]: async () => {
      const kind = await target.evaluate((n) => n.getAttribute('role') ?? (n as HTMLInputElement).type ?? '');
      if (TOGGLES.has(kind)) {
        await page.keyboard.press('Space');
        return;
      }
      if (kind !== 'radio') {
        await page.keyboard.press('Enter');
        return;
      }
      for (let i = 0; i < MAX_RADIOS && !(await isFocused(target)); i++) {
        await page.keyboard.press('ArrowRight');
      }
      if (await isFocused(target)) {
        return;
      }
      for (let i = 0; i < MAX_RADIOS && !(await isFocused(target)); i++) {
        await page.keyboard.press('Tab');
      }
      await page.keyboard.press('Enter');
    },
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
    [Op.Pick]: async () => {
      await page.keyboard.type(value);
      await page.waitForTimeout(PICK_MS);
      for (let i = 0; i < MAX_TABS; i++) {
        const name = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
        if (name === value) {
          break;
        }
        await page.keyboard.press('Tab');
      }
      await page.keyboard.press('Enter');
    },
    [Op.Drag]: () => page.keyboard.press('ArrowLeft'),
    [Op.Scrub]: () => page.keyboard.press('ArrowUp'),
    [Op.Arrow]: () => page.keyboard.press('ArrowUp'),
    [Op.ShiftArrow]: () => page.keyboard.press('Shift+ArrowUp'),
    [Op.ArrowDown]: () => page.keyboard.press('ArrowDown'),
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

async function settledShot(page: Page): Promise<Buffer> {
  let last = await layerShot(page);
  for (let i = 0; i < SETTLE_SHOTS; i++) {
    await page.waitForTimeout(SETTLE_MS);
    const now = await layerShot(page);
    if (now.equals(last)) {
      return now;
    }
    last = now;
  }
  return last;
}

async function repainted(page: Page, before: Buffer | null): Promise<boolean> {
  return expect
    .poll(async () => !!before && !before.equals(await layerShot(page)), { timeout: CANVAS_MS })
    .toBe(true)
    .then(() => true)
    .catch(() => false);
}

async function attempt(page: Page, row: Row, act: (target: Locator) => Promise<void>, failed: Check[], shoot: (tag: string) => Promise<void>): Promise<void> {
  const before = await readNow(page, row);
  trace(row.id, 'before', JSON.stringify(before));
  const pixels = row.canvas ? await settledShot(page) : null;
  try {
    await act(row.target(page));
  } catch (e) {
    failed.push(Check.Commit);
    trace(row.id, 'act threw', (e as Error).message.split('\n')[0]);
    await shoot('act');
    return;
  }
  trace(row.id, 'acted');
  if (!(await landed(page, row, before))) {
    failed.push(Check.Commit);
    await shoot('commit');
    await leaveField(page).catch(() => undefined);
    return;
  }
  if (row.canvas && !(await repainted(page, pixels))) {
    failed.push(Check.Canvas);
    await shoot('canvas');
  }
  trace(row.id, 'landed', JSON.stringify(await readNow(page, row)));
  await leaveField(page);
  if (row.local) {
    await row.reset?.(page);
    return;
  }
  await page.keyboard.press(UNDO);
  if (!(await restored(page, row, before))) {
    failed.push(Check.Undo);
    await shoot('undo');
  }
}

export async function exercise(page: Page, row: Row, shoot: (tag: string) => Promise<void>): Promise<Outcome> {
  const outcome: Outcome = { row, mouse: [], keyboard: [], notes: [] };
  trace(row.id, 'open');
  await open(page, row);
  trace(row.id, 'opened');
  const target = row.target(page);
  if (!(await target.waitFor({ state: 'visible', timeout: SHORT_MS }).then(() => true).catch(() => false))) {
    outcome.mouse.push(Check.Missing);
    outcome.keyboard.push(Check.Missing);
    await shoot('missing');
    return outcome;
  }

  if (row.mixed && !/mixed/i.test(await shownValue(target))) {
    outcome.mouse.push(Check.Mixed);
    outcome.notes.push(`shows "${await shownValue(target)}" for mixed values`);
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

  await select(page, row);
  await openSections(page);
  await row.prep?.(page);
  trace(row.id, 'keyboard pass');
  let from: Locator | null = startOf(page);
  const steps = [...(row.via ?? []), row.target];
  for (const [at, step] of steps.entries()) {
    const reached = await tabTo(page, from, step(page), row);
    if (reached !== Reached.Yes) {
      outcome.keyboard.push(Check.Reach);
      outcome.notes.push(`keyboard: ${reached}`);
      await shoot('keyboard-reach');
      await select(page, row);
      await openSections(page);
      for (const before of steps.slice(0, at)) {
        await before(page).focus({ timeout: SHORT_MS }).catch(() => undefined);
        await page.keyboard.press('Space');
        await page.waitForTimeout(SETTLE_MS);
      }
      await step(page).focus({ timeout: SHORT_MS }).catch(() => undefined);
    }
    if (step !== row.target) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(SETTLE_MS);
    }
    from = null;
  }
  await attempt(page, row, () => keyboardDo(page, row, row.target(page)), outcome.keyboard, (tag) => shoot(`keyboard-${tag}`));
  return outcome;
}
