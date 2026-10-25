import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installCursor, recordDemo } from '../record';

const CLI = fileURLToPath(new URL('../../../cli/cli.ts', import.meta.url));
const NOTE = 'Hello from an agent, no login';
const CANVAS_URL = /\/p\/([^/]+)\/c\/([^/?]+)/;

function agentWrites(appUrl: string, projectId: string, canvasId: string): string {
  const input = JSON.stringify({ canvasId, type: 'text', x: 200, y: 640, data: { text: NOTE } });
  return execFileSync('bun', [CLI, 'canvas', 'op', projectId, 'create_node', '--input', input], {
    env: { ...process.env, HOME: process.env.DEMO_HOME ?? process.env.HOME, PUBLIC_APP_URL: appUrl },
    encoding: 'utf8'
  });
}

test('local mode', async ({ page, baseURL }) => {
  await installCursor(page);
  await page.goto('/');
  await expect(page).toHaveURL(CANVAS_URL, { timeout: 120_000 });
  const [, projectId, canvasId] = CANVAS_URL.exec(page.url())!;
  await page.waitForTimeout(6000);

  await recordDemo(page, { slug: 'local-mode', title: 'local mode for agents' }, async (d) => {
    await d.wait(1500);
    await page.goto('/app');
    await expect(page).toHaveURL(CANVAS_URL, { timeout: 60_000 });
    await d.wait(4000);
    console.log(agentWrites(baseURL!, projectId, canvasId));
    const note = page.getByText(NOTE).first();
    await expect(note).toBeVisible({ timeout: 60_000 });
    await d.wait(800);
    await d.click(note);
    await d.wait(2500);
  });
});
