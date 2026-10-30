import puppeteer from 'puppeteer-core';
import { sandboxRunner } from '../../src/lib/server/code-import/sandbox-runner';
import { repoOf } from '../../src/lib/server/code-import/repo';

const [repoUrl, route] = process.argv.slice(2);
const run = await sandboxRunner({ token: process.env.VERCEL_TOKEN, teamId: process.env.VERCEL_TEAM_ID, projectId: process.env.VERCEL_PROJECT_ID })(repoOf(repoUrl)!, null);
if (!run.ok) {
  console.log('FAILED', run.failure, run.detail);
  process.exit(1);
}
console.log('url', run.app.url);
const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH, headless: 'shell' });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warn') && console.log('console', m.type(), m.text().slice(0, 300)));
  page.on('requestfailed', (r) => console.log('reqfail', r.url().slice(0, 150), r.failure()?.errorText));
  page.on('response', (r) => r.status() >= 400 && console.log('http', r.status(), r.url().slice(0, 150)));
  await page.goto(new URL(route, run.app.url).toString(), { waitUntil: 'networkidle2', timeout: 90_000 }).catch((e) => console.log('goto', e.message));
  await new Promise((r) => setTimeout(r, 8000));
  const info = await page.evaluate(() => {
    const els = [...document.body.querySelectorAll('*')];
    const withFiber = els.filter((el) => Object.keys(el).some((k) => k.startsWith('__reactFiber$')));
    const sample = withFiber.slice(0, 400).flatMap((el) => {
      const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))!;
      const chain: string[] = [];
      for (let f = (el as any)[key]; f && chain.length < 12; f = f.return) {
        const t = f.type;
        const name = typeof t === 'string' ? t : t?.displayName || t?.name || (t && (t.render?.name || t.type?.name)) || String(f.tag);
        const dbg = f._debugInfo ? `{dbg:${JSON.stringify(f._debugInfo.map((d: any) => ({ n: d?.name, env: d?.env, props: d?.props ? Object.keys(d.props) : undefined })))}}` : '';
        chain.push(`${f.tag}:${name}${dbg}`);
      }
      return chain.join(' < ').includes('dbg') ? [chain.join(' < ')] : [];
    });
    return { els: els.length, withFiber: withFiber.length, svelte: els.filter((e) => (e as any).__svelte_meta).length, vue: els.filter((e) => (e as any).__vueParentComponent).length, sample: sample.slice(0, 15) };
  });
  console.log(JSON.stringify(info, null, 2));
} finally {
  await browser.close();
  await run.app.stop();
}
