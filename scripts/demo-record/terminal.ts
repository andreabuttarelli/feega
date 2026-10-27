import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import type { Demo } from './demo';

const CLI = join(process.cwd(), 'cli', 'cli.ts');
const OUTPUT_MAX_LINES = 18;

export type Cli = { run: (args: string[]) => string };

export function signInCli(baseUrl: string): Cli {
  const home = mkdtempSync(join(tmpdir(), 'feega-cli-'));
  const env = { ...process.env, HOME: home, PUBLIC_APP_URL: baseUrl };
  const run = (args: string[]) => execFileSync('bun', [CLI, ...args], { env, encoding: 'utf8' }).trim();
  run(['login', '--email', process.env.E2E_TEST_EMAIL!, '--password', process.env.E2E_TEST_PASSWORD!]);
  return { run };
}

const PAGE = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#0e0e0f;color:#e9e6e0;font:22px/1.5 ui-monospace,Menlo,monospace}
#t{padding:56px 72px}.prompt{color:#7ee0a3;margin-right:14px}.row{display:flex;white-space:pre-wrap}
input{flex:1;background:none;border:0;outline:0;color:inherit;font:inherit;caret-color:#e9e6e0}
pre{margin:6px 0 22px;color:#a9a39a;font:inherit;white-space:pre-wrap}
</style><div id="t"><div id="log"></div><div class="row"><span class="prompt">$</span><input id="cmd" autofocus autocomplete="off" spellcheck="false"></div></div>`;

export async function openTerminal(page: Page): Promise<void> {
  await page.setContent(PAGE);
  await page.waitForTimeout(400);
}

function trimmed(output: string): string {
  const lines = output.split('\n');
  return lines.length > OUTPUT_MAX_LINES ? [...lines.slice(0, OUTPUT_MAX_LINES), '...'].join('\n') : output;
}

export async function typeCommand(page: Page, d: Demo, shown: string, run: () => string): Promise<void> {
  await d.type(page.locator('#cmd'), shown);
  const output = trimmed(run());
  await page.evaluate(([command, out]) => {
    const log = document.getElementById('log')!;
    const input = document.getElementById('cmd') as HTMLInputElement;
    log.insertAdjacentHTML('beforeend', `<div class="row"><span class="prompt">$</span>${command.replace(/</g, '&lt;')}</div>`);
    const pre = document.createElement('pre');
    pre.textContent = out;
    log.appendChild(pre);
    input.value = '';
  }, [shown, output]);
  await d.wait(2600);
}
