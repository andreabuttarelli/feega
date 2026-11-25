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
  env: () => ({ path: ['/bin'], home: '/none', exists: (p) => p === '/bin/opencode', appName: '', extensions: [] }),
  open: (_launch, deps) => openAcpAgent({ command: process.execPath, args: [FAKE] }, deps)
});
const { page } = panel;

await panel.pickAt('h1');
await page.waitForTimeout(400);
await page.locator('[data-testid=ai-tab]').click();
await page.locator('[data-testid=ai-agent]').click();
await page.locator('[data-testid=ai-agent-option][data-agent=opencode]').click();
await page.locator('[data-testid=ai-state][aria-label=Ready]').waitFor({ timeout: 8_000 });

const pickers = page.locator('[data-testid=ai-config]');
await pickers.first().waitFor();
assert.deepEqual(await pickers.allInnerTexts(), ['Sonnet', 'Medium']);

await pickers.nth(0).click();
await page.locator('[data-testid=ai-config-option][data-value=haiku]').waitFor();
await page.screenshot({ path: join(SHOTS, 'model-open.png') });
await page.locator('[data-testid=ai-config-option][data-value=haiku]').click();
await page.locator('[data-testid=ai-config][data-category=model]', { hasText: 'Haiku' }).waitFor();

await pickers.nth(1).click();
await page.locator('[data-testid=ai-config-option][data-value=high]').waitFor();
await page.screenshot({ path: join(SHOTS, 'model-effort.png') });
await page.locator('[data-testid=ai-config-option][data-value=high]').click();
await page.locator('[data-testid=ai-config][data-category=thought_level]', { hasText: 'High' }).waitFor();
await panel.close();
process.exit(0);
