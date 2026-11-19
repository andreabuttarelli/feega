import { readFileSync } from 'node:fs';
import { ROWS, Section } from '../src/webview/controls.ts';
import { openPanel } from './harness.mts';

const [appRoot, textSelector, boxSelector] = process.argv.slice(2);
const HMR_MS = 2500;

const VALUES: Record<string, string> = {
  direction: 'flex-col',
  align: 'items-center',
  justify: 'justify-between',
  gap: '24',
  width: '480',
  height: '200',
  'padding-x': '24',
  'padding-y': '24',
  'font-size': '32',
  'font-weight': '700',
  'text-align': 'text-center',
  color: '#0078d4',
  fill: '#ffcc00',
  radius: '12',
  border: '3',
  opacity: '50',
  shadow: 'shadow-lg'
};

const ON_TEXT = new Set([Section.Typography]);
const LOOSE = new Set(['box-shadow']);

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const panel = await openPanel(appRoot);
const results: { row: string; ok: boolean; wanted: string; got: string; note: string }[] = [];

const ONLY = process.env.ONLY;

for (const row of ROWS.filter((r) => !ONLY || ONLY.split(",").includes(r.name))) {
  const selector = ON_TEXT.has(row.section) ? textSelector : boxSelector;
  const value = VALUES[row.name];
  const pick = await panel.pickAt(selector);
  if (!pick) {
    results.push({ row: row.name, ok: false, wanted: value, got: '', note: 'not picked' });
    continue;
  }

  const file = `${appRoot}/${pick.source.file}`;
  const before = readFileSync(file, 'utf8');
  const saves = panel.saves.length;
  await panel.reply({ kind: 'change', row: row.name, value });
  await panel.page.waitForTimeout(HMR_MS);
  const saved = panel.saves[saves] as { ok: boolean; reason?: string } | undefined;

  await panel.page.locator('[data-testid=app-frame]').evaluate((f: HTMLIFrameElement) => (f.src = f.src));
  await panel.page.waitForTimeout(HMR_MS);

  const css = Object.entries(row.preview(value)).map(([k, v]) => [kebab(k), v] as const);
  const [name] = css[0];
  const raw = Object.fromEntries(css);
  const target = panel.frame.locator(`[data-feega-src="${pick.source.file}:${pick.source.line}:${pick.source.col}"]`).first();
  const [got, wanted] = await target.evaluate(
    (el, [prop, v]: [string, Record<string, string>]) => {
      const probe = document.createElement(el.tagName);
      Object.entries(v).forEach(([k, val]) => probe.style.setProperty(k, val));
      document.body.append(probe);
      const want = getComputedStyle(probe).getPropertyValue(prop);
      probe.remove();
      return [getComputedStyle(el).getPropertyValue(prop), want];
    },
    [name, raw] as [string, Record<string, string>]
  );

  const ok = LOOSE.has(name) ? got !== 'none' && got !== '' : got === wanted;
  const now = readFileSync(file, 'utf8');
  const changed = now !== before;
  if (ONLY) {
    console.log(now.split('\n').filter((l, i) => l !== before.split('\n')[i]).join('\n'), pick.source);
  }
  results.push({ row: row.name, ok: ok && changed, wanted, got, note: saved?.ok === false ? `refused: ${saved.reason}` : changed ? '' : 'file unchanged' });
  await panel.edits.undo();
  await panel.page.waitForTimeout(HMR_MS);
}

await panel.close();
console.log(`\n${panel.styling} · ${appRoot}`);
console.table(results);
process.exit(results.every((r) => r.ok) ? 0 : 1);
