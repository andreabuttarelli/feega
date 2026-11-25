import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOTS = process.env.SHOTS ?? join(homedir(), 'Documents/feega-videos/classes-panel');
const CLASS = process.env.CLASS ?? 'card-alt';
const SELECTOR = process.env.SELECTOR ?? '.card-alt';
const SHEET = process.env.SHEET ?? 'src/styles.css';

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;
const section = page.locator('[data-testid=classes]');

await panel.pickAt(SELECTOR);
await section.waitFor({ timeout: 10_000 });
const listed = await section.innerText();
console.log({ listed });
assert.match(listed, new RegExp(`\\.${CLASS}`), 'the element classes are listed');
assert.match(listed, /elements? · \d+ files?/, 'usage counts are shown');
await page.screenshot({ path: join(SHOTS, '1-classes-section.png') });

await section.locator(`[data-class="${CLASS}"] [data-action=class-open]`).click();
await page.locator('[data-testid=class-view]').waitFor();
const view = await page.locator('[data-testid=class-view]').innerText();
console.log({ view });
assert.match(view, new RegExp(`${SHEET.replace('.', '\\.')}:\\d+`), 'the rule is listed with file:line');
assert.match(view, /Used in/, 'the uses are listed');
await page.screenshot({ path: join(SHOTS, '2-class-view.png') });

await section.locator(`[data-class="${CLASS}"] [data-action=class-edit]`).click();
await page.locator('[data-testid=class-editing]').waitFor();
const editing = await page.locator('[data-testid=class-editing]').innerText();
assert.match(editing, new RegExp(`Editing: \\.${CLASS} \\(global\\)`));
await page.waitForTimeout(500);
const impact = await page.locator('[data-testid=impact]').innerText();
console.log({ impact });
assert.match(impact, new RegExp(`\\.${CLASS} in \\d+ elements?, \\d+ files?`), 'the impact line names the class');
await page.locator('[data-testid=class-editing]').scrollIntoViewIfNeeded();
await page.screenshot({ path: join(SHOTS, '3-editing-class.png') });

const before = readFileSync(join(process.env.INSPECT_APP_ROOT!, SHEET), 'utf8');
const field = page.locator('[data-row="padding"] input, [data-field*=padding] input, [data-field*=padding]').first();
await field.waitFor({ timeout: 5000 });
const next = 41 + (Date.now() % 50);
await field.fill(String(next));
await field.press('Enter');
await page.waitForTimeout(1500);
const after = readFileSync(join(process.env.INSPECT_APP_ROOT!, SHEET), 'utf8');
console.log(after.split('\n').slice(0, 0).join(''));
assert.notEqual(after, before, 'the class rule changed');
assert.match(after, new RegExp(`\\.${CLASS} \\{[^}]*padding: ${next}px`), 'the padding landed in the class rule');
await page.locator('[data-testid=changes-tab]').click();
await page.waitForTimeout(300);
const changes = await page.locator('aside.right').innerText();
assert.match(changes, new RegExp(`class \\.${CLASS}`), 'Changes lists the class edit');
await page.screenshot({ path: join(SHOTS, '4-changes.png') });

writeFileSync(join(process.env.INSPECT_APP_ROOT!, SHEET), before);
await panel.close();
