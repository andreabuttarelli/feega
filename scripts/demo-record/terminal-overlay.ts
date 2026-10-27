import type { Page } from '@playwright/test';

const OVERLAY = `
<style>
#term-overlay{position:fixed;left:0;right:0;bottom:0;height:46%;z-index:2147483000;background:#0e0e0f;color:#e9e6e0;font:20px/1.5 ui-monospace,Menlo,monospace;padding:28px 48px;overflow:auto;box-shadow:0 -12px 40px rgba(0,0,0,.35)}
#term-overlay .prompt{color:#7ee0a3;margin-right:14px}#term-overlay .row{display:flex;white-space:pre-wrap}
#term-overlay input{flex:1;background:none;border:0;outline:0;color:inherit;font:inherit;caret-color:#e9e6e0}
#term-overlay pre{margin:6px 0 18px;color:#a9a39a;font:inherit;white-space:pre-wrap}
</style>
<div id="log"></div><div class="row"><span class="prompt">$</span><input id="cmd" autocomplete="off" spellcheck="false"></div>`;

export async function openTerminalOverlay(page: Page): Promise<void> {
  await page.evaluate((html) => {
    const box = document.createElement('div');
    box.id = 'term-overlay';
    box.innerHTML = html;
    document.body.appendChild(box);
  }, OVERLAY);
  await page.waitForTimeout(400);
}
