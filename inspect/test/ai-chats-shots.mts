import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openAcpAgent } from '../src/host/ai/acp-session.ts';
import { openPanel } from './harness.mts';

const SHOTS = process.env.SHOTS_DIR!;
const APP = process.env.INSPECT_APP_ROOT!;
const FAKE = fileURLToPath(new URL('../src/host/ai/fake-acp-agent.mjs', import.meta.url));
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
await page.locator('[data-testid=ai-agent-option][data-agent=opencode]').click();
await page.locator('[data-testid=ai-state][aria-label=Ready]').waitFor({ timeout: 8_000 }).catch(async (e) => { await page.screenshot({ path: '/tmp/dbg.png' }); console.log(await page.locator('[data-testid=ai-panel]').innerText()); throw e; });
await page.locator('[data-testid=ai-input]').fill('wait');
await page.locator('[data-testid=ai-send]').click();
await page.locator('[data-testid=ai-thinking]').waitFor({ timeout: 10_000 });

await page.locator('[data-testid=ai-history]').click();
await page.locator('[data-testid=ai-new-chat]').click();
await page.locator('[data-testid=ai-state][aria-label=Ready]').waitFor({ timeout: 8_000 }).catch(async (e) => { await page.screenshot({ path: '/tmp/dbg.png' }); console.log(await page.locator('[data-testid=ai-panel]').innerText()); throw e; });
await page.locator('[data-testid=ai-input]').fill('Make the heading smaller');
await page.locator('[data-testid=ai-send]').click();
await page.locator('.agent', { hasText: 'Hello' }).waitFor({ timeout: 10_000 });

await page.locator('[data-testid=ai-history]').click();
await page.locator('[data-testid=ai-chat-row]').first().waitFor();
assert.equal(await page.locator('[data-testid=ai-chat-row]').count(), 2, 'both chats are listed');
assert.equal(await page.locator('[data-testid=ai-chat-running]').count(), 1, 'the first chat is still working');
await page.screenshot({ path: join(SHOTS, 'chats-menu.png') });
await page.locator('[data-testid=ai-chat-row]', { hasText: 'wait' }).locator('.chat-open').click();
await page.locator('[data-testid=ai-thinking]').waitFor({ timeout: 10_000 });
await panel.close();
process.exit(0);
