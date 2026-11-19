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
  'font-family': 'Georgia',
  'line-height': '28',
  'letter-spacing': '2',
  'fill-image': 'linear-gradient(90deg, rgb(255, 0, 0) 0%, rgb(0, 0, 255) 100%)',
  radius: '12',
  border: '3',
  opacity: '50',
  shadow: '0px 10px 15px -3px rgba(0, 0, 0, 0.1)',
  'text-shadow': '0px 2px 4px rgba(0, 0, 0, 0.5)'
};

const ON_TEXT = new Set([Section.Typography]);

const valueOf = (name: string) => VALUES[name] ?? (name.startsWith('margin-') ? '12' : name.startsWith('padding-') ? '24' : '12');
const LOOSE = new Set(['box-shadow', 'text-shadow']);

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const panel = await openPanel(appRoot);
const results: { row: string; ok: boolean; wanted: string; got: string; note: string }[] = [];

const ONLY = process.env.ONLY;

for (const row of ROWS.filter((r) => !ONLY || ONLY.split(",").includes(r.name))) {
  const selector = ON_TEXT.has(row.section) ? textSelector : boxSelector;
  const bare = valueOf(row.name);
  const value = 'units' in row && row.units ? `${bare}px` : bare;
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
  results.push({ row: row.name, ok: ok && saved?.ok !== false, wanted, got, note: saved?.ok === false ? `refused: ${saved.reason}` : changed ? '' : 'written elsewhere or already set' });
  await panel.edits.undo();
  await panel.page.waitForTimeout(HMR_MS);
}

const TEXT = 'Edited by the matrix';
const textPick = await panel.pickAt(textSelector);
const reloadFrame = async () => {
  await panel.page.locator('[data-testid=app-frame]').evaluate((f: HTMLIFrameElement) => (f.src = f.src));
  await panel.page.waitForTimeout(HMR_MS);
};
const textOf = () => panel.frame.locator(textSelector).first().innerText();
const before = await textOf();
const textWrite = textPick ? await panel.edits.edit({ at: `${textPick.source.file}:${textPick.source.line}:${textPick.source.col}`, prop: 'text' as never, value: TEXT }) : { ok: false, reason: 'not picked' };
await panel.page.waitForTimeout(HMR_MS);
await reloadFrame();
const textAfter = await textOf();
results.push({ row: 'text edit', ok: textWrite.ok && textAfter.trim() === TEXT, wanted: TEXT, got: textAfter.trim(), note: textWrite.ok ? '' : `refused: ${(textWrite as { reason: string }).reason}` });
if (textWrite.ok) {
  await panel.edits.undo();
  await panel.page.waitForTimeout(HMR_MS);
  await reloadFrame();
  const restored = await textOf();
  results.push({ row: 'undo', ok: restored === before, wanted: before, got: restored, note: '' });
}

await panel.close();
console.log(`\n${panel.styling} · ${appRoot}`);
console.table(results);
process.exit(results.every((r) => r.ok) ? 0 : 1);
