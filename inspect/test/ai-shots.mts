import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openAcpAgent } from '../src/host/ai/acp-session.ts';
import { openPanel } from './harness.mts';

const SHOTS = process.env.SHOTS_DIR!;
const APP = process.env.INSPECT_APP_ROOT!;
const FAKE = fileURLToPath(new URL('../src/host/ai/fake-acp-agent.mjs', import.meta.url));
const TARGET = 'src/links.js';
mkdirSync(SHOTS, { recursive: true });

const panel = await openPanel(APP, undefined, undefined, {
  env: () => ({ path: ['/bin'], home: '/none', exists: (p) => p === '/bin/opencode' || p === '/bin/gemini', appName: '', extensions: [] }),
  open: (_launch, deps) => openAcpAgent({ command: process.execPath, args: [FAKE] }, deps)
});
const { page } = panel;

await panel.pickAt('h1');
await page.waitForTimeout(400);
await page.locator('[data-testid=ai-tab]').click();
await page.locator('[data-testid=ai-agent]').click();
assert.equal(await page.locator('[data-testid=ai-agent-missing]').count(), 16, 'agents that are not installed sit dimmed inside the menu');
await page.screenshot({ path: join(SHOTS, '2-dropdown.png') });
await page.locator('[data-testid=ai-agent-option][data-agent=opencode]').click();
await page.locator('[data-testid=ai-state][aria-label=Ready]').waitFor({ timeout: 15_000 });
assert.equal(await page.locator('[data-testid=ai-suggestion]').count(), 3, 'the empty state offers three suggestions');
assert.ok(await page.locator('[data-testid=ai-chip]').count(), 'the selection is attached as a chip');
await page.screenshot({ path: join(SHOTS, '1-empty.png') });

await page.locator('[data-testid=ai-permissions]').click();
assert.equal(await page.locator('[data-testid=ai-mode-option]').count(), 3, 'the agent modes are listed');
assert.equal(await page.locator('[data-testid=ai-policy-option]').count(), 3, 'the Feega policies are listed');
await page.screenshot({ path: join(SHOTS, '8-permissions.png') });
await page.locator('[data-testid=ai-mode-option][data-mode=plan]').click();
await page.locator('[data-testid=ai-permissions]', { hasText: 'Plan' }).waitFor({ timeout: 10_000 });
await page.locator('[data-testid=ai-permissions]').click();
await page.locator('[data-testid=ai-policy-option][data-policy=all]').click();
await page.locator('[data-testid=ai-permissions].danger').waitFor({ timeout: 10_000 });
await page.screenshot({ path: join(SHOTS, '9-allow-all.png') });
await page.locator('[data-testid=ai-permissions]').click();
await page.locator('[data-testid=ai-policy-option][data-policy=ask]').click();
await page.locator('[data-testid=ai-permissions]', { hasText: 'Plan · Ask' }).waitFor({ timeout: 10_000 });

await page.locator('[data-testid=ai-suggestion]').first().click();
assert.equal(await page.locator('[data-testid=ai-input]').inputValue(), 'Make this more spacious');
await page.locator('[data-testid=ai-input]').fill('hello');
await page.locator('[data-testid=ai-input]').press('Shift+Enter');
await page.locator('[data-testid=ai-input]').pressSequentially('again');
await page.screenshot({ path: join(SHOTS, '3-chip.png') });
await page.locator('[data-testid=ai-input]').fill('hello');
await page.locator('[data-testid=ai-input]').press('Enter');
await page.locator('.agent', { hasText: 'Hello' }).waitFor({ timeout: 10_000 });
await page.screenshot({ path: join(SHOTS, '4-reply.png') });

await page.locator('[data-testid=ai-input]').fill('wait');
await page.locator('[data-testid=ai-send]').click();
await page.locator('[data-testid=ai-thinking]').waitFor({ timeout: 10_000 });
await page.screenshot({ path: join(SHOTS, '5-streaming.png') });
await page.locator('[data-testid=ai-cancel]').click();
await page.locator('[data-testid=ai-send]').waitFor({ timeout: 10_000 });

await page.locator('[data-testid=ai-chip] button').click();
assert.equal(await page.locator('[data-testid=ai-chip]').count(), 0, 'the chip can be removed');

await page.locator('[data-testid=ai-input]').fill(`write ${TARGET}`);
await page.locator('[data-testid=ai-send]').click();
await page.locator('[data-testid=ai-permission]').waitFor({ timeout: 10_000 });
await page.screenshot({ path: join(SHOTS, '6-permission.png') });
await page.locator('[data-testid=ai-option]', { hasText: 'Allow' }).click();
await page.locator('.agent', { hasText: 'done' }).waitFor({ timeout: 10_000 });
assert.equal(readFileSync(join(APP, TARGET), 'utf8'), 'written by the agent\n');
await page.locator('[data-testid=ai-tool]').last().locator('summary').click();
await page.screenshot({ path: join(SHOTS, '7-tool-done.png') });

await page.locator('[data-testid=changes-tab]').click();
await page.waitForTimeout(300);
assert.match(await page.locator('[data-testid=changes-tab]').innerText(), /Changes 1/);
await panel.close();
process.exit(0);
