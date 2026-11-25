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
  env: () => ({ path: ['/bin'], home: '/none', exists: (p) => p === '/bin/opencode' || p === '/bin/claude' || p === '/bin/kiro-cli' || p === '/bin/cline' || p === '/bin/goose' || p === '/bin/grok', appName: '', extensions: [] }),
  open: (_launch, deps) => openAcpAgent({ command: process.execPath, args: [FAKE] }, deps)
});
const { page } = panel;

await panel.pickAt('h1');
await page.waitForTimeout(400);
await page.locator('[data-testid=ai-tab]').click();
await page.locator('[data-testid=ai-agent]').click();
await page.screenshot({ path: join(SHOTS, '1-picker.png') });
await page.locator('[data-testid=ai-agent-option][data-agent=claude]').click();
await page.locator('[data-testid=ai-state][aria-label=Ready]').waitFor({ timeout: 15_000 });
await page.screenshot({ path: join(SHOTS, '3-connected.png') });
await page.locator('[data-testid=ai-agent]').click();
await page.locator('[data-testid=ai-agent-option][data-agent=claude]').click();
await panel.close();
