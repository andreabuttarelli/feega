import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { IMPORTED_NODE, KINDS_NODE, Layer } from './fixtures/inspector-audit/fixture';
import { openCanvas } from './fixtures/inspector-audit/harness';
import { sweepLayer, type Finding } from './fixtures/inspector-audit/sweep';
import { ROWS, Check } from './fixtures/inspector-audit/controls';
import { exercise, type Outcome } from './fixtures/inspector-audit/behaviour';

const OUT = process.env.INSPECTOR_AUDIT_OUT ?? join(homedir(), 'Documents/feega-videos/inspector-audit');
const ONLY = process.env.INSPECTOR_AUDIT_ONLY?.split(',') ?? null;
const PICKED = process.env.INSPECTOR_AUDIT_ROWS ? new RegExp(process.env.INSPECTOR_AUDIT_ROWS) : null;

const KINDS = [Layer.Rect, Layer.Ellipse, Layer.Line, Layer.Star, Layer.Vector, Layer.Text, Layer.Image, Layer.Stack, Layer.StackChild, Layer.Group, Layer.Instance, Layer.Mask, Layer.Masked, Layer.Shadowed, Layer.Styled, Layer.Bound, Layer.Null];
const IMPORTED = [Layer.ImportedText, Layer.ImportedPill, Layer.ImportedCard];
const SWEPT = [...KINDS.map((layer) => ({ node: KINDS_NODE, layer })), ...IMPORTED.map((layer) => ({ node: IMPORTED_NODE, layer }))].filter((s) => !ONLY || ONLY.includes(s.layer));
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

test.describe('inspector audit', () => {
  test('sweep: every visible control on every layer kind can be hit, named and tabbed to', async () => {
    test.skip(!process.env.INSPECTOR_AUDIT_SWEEP, 'INSPECTOR_AUDIT_SWEEP=1 runs the reach sweep');
    const found: Finding[] = [];
    for (const { node, layer } of SWEPT) {
      found.push(...(await sweepLayer(page, node, layer)));
      writeFileSync(join(OUT, 'sweep.json'), JSON.stringify(found, null, 1));
    }
  });

  for (const row of EXERCISED) {
    test(row.id, async () => {
      thrown.length = 0;
      const outcome = await exercise(page, row, async (tag) => {
        await page.screenshot({ path: join(OUT, 'shots', `${slug(row.id)}-${tag}.png`) });
      });
      if (thrown.length) {
        outcome.mouse.push(Check.Throws);
        outcome.notes.push(...thrown);
      }
      record(outcome);
      expect({ mouse: outcome.mouse, keyboard: outcome.keyboard }, outcome.notes.join('; ')).toEqual({ mouse: row.known?.mouse ?? [], keyboard: row.known?.keyboard ?? [] });
    });
  }
});
