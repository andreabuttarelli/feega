import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => [{ address: /^[\d.]+$/.test(host) ? host : host === 'rebind.example' ? '10.0.0.1' : '93.184.216.34', family: 4 }])
}));

import { RequestVerdict, requestVerdict } from './screenshot';

describe('screenshot request guard', () => {
  it.each([
    ['https://a.example/app.js', RequestVerdict.Continue],
    ['data:image/png;base64,AAAA', RequestVerdict.Continue],
    ['blob:https://a.example/1', RequestVerdict.Continue],
    ['http://127.0.0.1:5173/', RequestVerdict.Abort],
    ['http://169.254.169.254/latest/meta-data/', RequestVerdict.Abort],
    ['http://rebind.example/', RequestVerdict.Abort],
    ['http://localhost/', RequestVerdict.Abort],
    ['file:///etc/passwd', RequestVerdict.Abort],
    ['ws://a.example/', RequestVerdict.Abort]
  ])('%s → %s', async (url, verdict) => {
    expect(await requestVerdict(url)).toBe(verdict);
  });
});

describe('the dev server reading itself', () => {
  const SELF = 'http://localhost:5301';

  it('lets the browser open the dev server it runs in, so app_browse signs in to the local app', async () => {
    expect(await requestVerdict(`${SELF}/login`, SELF)).toBe(RequestVerdict.Continue);
  });

  it('keeps every other private address closed', async () => {
    expect(await requestVerdict('http://localhost:5173/', SELF)).toBe(RequestVerdict.Abort);
    expect(await requestVerdict('http://127.0.0.1:5301/', SELF)).toBe(RequestVerdict.Abort);
  });
});
