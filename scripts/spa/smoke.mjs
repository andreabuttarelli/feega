import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SPA = process.argv[2];
const SHOTS = process.argv[3];
const url = process.env.PUBLIC_SUPABASE_URL;
const ref = new URL(url).hostname.split('.')[0];
const CHUNK = 3180;

const anon = createClient(url, process.env.PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data, error } = await anon.auth.signInWithPassword({ email: process.env.E2E_TEST_EMAIL, password: process.env.E2E_TEST_PASSWORD });
if (error) throw error;

const value = 'base64-' + Buffer.from(JSON.stringify(data.session)).toString('base64url');
const name = `sb-${ref}-auth-token`;
const chunks = value.length <= CHUNK ? [[name, value]] : Array.from({ length: Math.ceil(value.length / CHUNK) }, (_, i) => [`${name}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK)]);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies(chunks.map(([n, v]) => ({ name: n, value: v, url: SPA })));
const page = await context.newPage();
const errors = [];
const apiCalls = [];
page.on('pageerror', (e) => errors.push(`${e.message} ${e.stack?.split('\n').slice(1, 3).join(' | ')}`));
page.on('response', (r) => { if (r.url().includes('/api/v1/')) apiCalls.push(`${r.status()} ${new URL(r.url()).pathname}`); });
page.on('response', (r) => { const t = r.request().resourceType(); if (t !== 'document' && !r.url().includes('/api/v1/') && (r.headers()['content-type'] ?? '').includes('text/html')) errors.push(`html for ${new URL(r.url()).pathname} from ${r.request().frame()?.url() ?? 'worker'}`); });
page.on('requestfailed', (r) => errors.push(`failed ${r.url()} ${r.failure()?.errorText}`));

await page.goto(`${SPA}/app`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${SHOTS}/1-dashboard.png` });
console.log('dashboard url', page.url());

const projectHref = await page.locator('a[href^="/p/"]').first().getAttribute('href');
console.log('project link', projectHref);
await page.goto(`${SPA}${projectHref}`);
await page.waitForURL(/\/p\/[^/]+\/c\/[^/]+/, { timeout: 30000 });
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SHOTS}/2-canvas.png` });
console.log('canvas url', page.url());
console.log('canvas nodes', await page.locator('.svelte-flow__node, [data-motion-node]').count());

console.log('api calls', JSON.stringify([...new Set(apiCalls)], null, 1));
console.log('errors', JSON.stringify(errors, null, 1));
await browser.close();
