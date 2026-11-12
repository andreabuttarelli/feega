import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { AREAS_NODE, IMPORTED_NODE, KINDS_NODE, Layer, MAINS_NODE, effectLayer } from './fixtures/inspector-audit/fixture';
import { EffectKind } from '@feega/motion-core/motion/effects/registry';
import { openCanvas } from './fixtures/inspector-audit/harness';
import { sweepLayer, type Finding } from './fixtures/inspector-audit/sweep';
import { ROWS, Check, State } from './fixtures/inspector-audit/controls';
import { KNOWN } from './fixtures/inspector-audit/known';
import { exercise, type Outcome, type Selection } from './fixtures/inspector-audit/behaviour';

const OUT = process.env.INSPECTOR_AUDIT_OUT ?? join(homedir(), 'Documents/feega-videos/inspector-audit');
const ONLY = process.env.INSPECTOR_AUDIT_ONLY?.split(',') ?? null;
const PICKED = process.env.INSPECTOR_AUDIT_ROWS ? new RegExp(process.env.INSPECTOR_AUDIT_ROWS) : null;

const KINDS = [Layer.Rect, Layer.Ellipse, Layer.Line, Layer.Star, Layer.Vector, Layer.Text, Layer.Image, Layer.Stack, Layer.StackChild, Layer.Group, Layer.Instance, Layer.Mask, Layer.Masked, Layer.Shadowed, Layer.Styled, Layer.Bound, Layer.Null, Layer.Gradient];
const IMPORTED = [Layer.ImportedText, Layer.ImportedPill, Layer.ImportedCard];
const single = (node: string, layer: Layer, state = State.Single): Selection => ({ node, layer, state });
const SWEPT: Selection[] = [
  ...KINDS.map((layer) => single(KINDS_NODE, layer)),
  ...IMPORTED.map((layer) => single(IMPORTED_NODE, layer, State.Imported)),
  single(AREAS_NODE, Layer.CardInstance, State.Instance),
  single(MAINS_NODE, Layer.Card, State.Instance),
  single(AREAS_NODE, Layer.ImageFill),
  ...[EffectKind.DropShadow, EffectKind.ChromaKey, EffectKind.Levels, EffectKind.Lut].map((kind) => single(AREAS_NODE, effectLayer(kind) as Layer)),
  single(AREAS_NODE, Layer.Frame, State.Frame),
  { node: AREAS_NODE, layer: Layer.MixA, state: State.Mixed, with: [Layer.MixB] }
].filter((s) => !ONLY || ONLY.includes(s.layer));
const NARROW = { width: 800, height: 600 };
const NARROWED = new Set<string>([Layer.Rect, Layer.Text, Layer.Stack, Layer.StackChild, Layer.CardInstance, Layer.ImageFill, Layer.MixA, effectLayer(EffectKind.DropShadow)]);
const EXERCISED = ROWS.filter((r) => !PICKED || PICKED.test(r.id));

const slug = (id: string) => id.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

let page: Page;
const thrown: string[] = [];

test.beforeAll(async ({ browser, baseURL, viewport }) => {
  mkdirSync(join(OUT, 'shots'), { recursive: true });
  mkdirSync(join(OUT, 'rows'), { recursive: true });
  page = await browser.newPage({ baseURL, viewport });
  page.on('pageerror', (e) => thrown.push(e.message));
  await openCanvas(page);
});

test.afterAll(async () => {
  await page.close();
});

const record = (o: Outcome) => writeFileSync(join(OUT, 'rows', `${slug(o.row.id)}.json`), JSON.stringify({ id: o.row.id, layer: o.row.layer, section: o.row.section, control: o.row.control, option: o.row.option, state: o.row.state, mouse: o.mouse, keyboard: o.keyboard, notes: o.notes, known: o.row.known ?? null }));

type Checks = { mouse: Check[]; keyboard: Check[] };
const sameChecks = (a: Checks, b: Checks) => JSON.stringify([a.mouse, a.keyboard]) === JSON.stringify([b.mouse, b.keyboard]);

async function attemptRow(row: (typeof ROWS)[number]): Promise<Outcome> {
  thrown.length = 0;
  const outcome = await exercise(page, row, async (tag) => {
    await page.screenshot({ path: join(OUT, 'shots', `${slug(row.id)}-${tag}.png`) });
  });
  if (thrown.length) {
    outcome.mouse.push(Check.Throws);
    outcome.notes.push(...thrown);
  }
  return outcome;
}

test('every known failure names a row that exists', () => {
  const ids = new Set(ROWS.map((r) => r.id));
  expect(Object.keys(KNOWN).filter((id) => !ids.has(id))).toEqual([]);
});

test.describe('inspector audit', () => {
  test('sweep: every visible control on every layer kind can be hit, named and tabbed to', async () => {
    test.skip(!process.env.INSPECTOR_AUDIT_SWEEP, 'INSPECTOR_AUDIT_SWEEP=1 runs the reach sweep');
    const found: Finding[] = [];
    for (const at of SWEPT) {
      found.push(...(await sweepLayer(page, at)));
      writeFileSync(join(OUT, 'sweep.json'), JSON.stringify(found, null, 1));
    }
  });

  test('narrow: at the smallest window every control can still be hit and stays inside it', async () => {
    test.skip(!process.env.INSPECTOR_AUDIT_SWEEP, 'INSPECTOR_AUDIT_SWEEP=1 runs the narrow sweep');
    await page.setViewportSize(NARROW);
    const found: Finding[] = [];
    for (const at of SWEPT.filter((s) => NARROWED.has(s.layer) || s.state === State.Frame)) {
      found.push(...(await sweepLayer(page, at)));
      writeFileSync(join(OUT, 'sweep-narrow.json'), JSON.stringify(found, null, 1));
    }
    await page.setViewportSize(test.info().project.use.viewport!);
  });

  for (const row of EXERCISED) {
    test(row.id, async () => {
      const expected = { mouse: row.known?.mouse ?? [], keyboard: row.known?.keyboard ?? [] };
      let outcome = await attemptRow(row);
      if (!sameChecks(outcome, expected)) {
        outcome = await attemptRow(row);
        outcome.notes.push('second attempt');
      }
      record(outcome);
      if (process.env.INSPECTOR_AUDIT_RECORD) {
        return;
      }
      expect({ mouse: outcome.mouse, keyboard: outcome.keyboard }, outcome.notes.join('; ')).toEqual(expected);
    });
  }
});
