import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }));

import { lookup } from 'node:dns/promises';
import { BROWSE_MAX_SHOTS, StepKind, browse, type BrowseStep } from './browse';
import type { Tab } from './browser';

const PAGE = '<html><head><title>Shop</title></head><body><main><h1>Wool shoes</h1><p>Light and warm.</p><a href="/pricing">Pricing</a><img src="/hero.jpg" alt="hero"></main></body></html>';

function fakeTab(over: Partial<Tab> = {}) {
  let at = 'about:blank';
  const tab: Tab = {
    goto: vi.fn(async (url: string) => {
      at = url;
      return 200;
    }),
    url: () => at,
    html: vi.fn(async () => PAGE),
    look: vi.fn(async () => ({ background: null, text: null, button: null, body: null, heading: null })),
    click: vi.fn(async () => undefined),
    type: vi.fn(async () => undefined),
    scroll: vi.fn(async () => undefined),
    waitFor: vi.fn(async () => undefined),
    sensitive: vi.fn(async () => false),
    shot: vi.fn(async () => Buffer.from('jpeg')),
    close: vi.fn(async () => 0.004),
    ...over
  };
  return tab;
}

beforeEach(() => {
  vi.mocked(lookup).mockImplementation((async (host: string) => [{ address: /^[\d.]+$/.test(host) ? host : host === 'internal.example' ? '10.0.0.1' : '93.184.216.34', family: 4 }]) as never);
});

describe('browse: a few steps in a real browser, inside fences', () => {
  it('runs the steps in order, returns what they extracted and what it cost', async () => {
    const tab = fakeTab();
    const steps: BrowseStep[] = [
      { do: StepKind.Click, text: 'Accept cookies' },
      { do: StepKind.Scroll, to: 'bottom' },
      { do: StepKind.Extract, what: 'links' },
      { do: StepKind.Extract, what: 'markdown' },
      { do: StepKind.Screenshot }
    ];

    const out = await browse('https://shop.example/', steps, async () => tab);

    expect(out).toMatchObject({ ok: true, costUsd: 0.004, url: 'https://shop.example/' });
    if (!out.ok) {
      return;
    }
    expect(out.steps.map((s) => s.do)).toEqual([StepKind.Navigate, StepKind.Click, StepKind.Scroll, StepKind.Extract, StepKind.Extract, StepKind.Screenshot]);
    expect(out.steps[3]).toMatchObject({ ok: true, links: [{ url: 'https://shop.example/pricing', text: 'Pricing' }] });
    expect(out.steps[4]).toMatchObject({ ok: true, markdown: expect.stringContaining('Wool shoes') });
    expect(out.shots).toHaveLength(1);
    expect(tab.close).toHaveBeenCalled();
  });

  it('refuses a private address before opening anything', async () => {
    const open = vi.fn();

    expect(await browse('http://internal.example/', [], open)).toMatchObject({ ok: false });
    expect(open).not.toHaveBeenCalled();
  });

  it('refuses a navigation step into a private address and keeps going', async () => {
    const tab = fakeTab();

    const out = await browse('https://shop.example/', [{ do: StepKind.Navigate, url: 'http://169.254.169.254/' }, { do: StepKind.Extract, what: 'markdown' }], async () => tab);

    expect(out.ok && out.steps[1]).toMatchObject({ ok: false });
    expect(out.ok && out.steps[2]).toMatchObject({ ok: true });
    expect(tab.goto).toHaveBeenCalledTimes(1);
  });

  it('will not type into or submit a password or card field', async () => {
    const tab = fakeTab({ sensitive: vi.fn(async () => true) });

    const out = await browse('https://shop.example/', [{ do: StepKind.Type, selector: '#pw', text: 'hunter2' }, { do: StepKind.Click, selector: 'button[type=submit]' }], async () => tab);

    expect(out.ok && out.steps.slice(1)).toEqual([
      { do: StepKind.Type, ok: false, error: expect.stringContaining('password or payment') },
      { do: StepKind.Click, ok: false, error: expect.stringContaining('password or payment') }
    ]);
    expect(tab.type).not.toHaveBeenCalled();
    expect(tab.click).not.toHaveBeenCalled();
  });

  it(`takes at most ${BROWSE_MAX_SHOTS} screenshots`, async () => {
    const tab = fakeTab();
    const steps: BrowseStep[] = Array.from({ length: BROWSE_MAX_SHOTS + 1 }, () => ({ do: StepKind.Screenshot }));

    const out = await browse('https://shop.example/', steps, async () => tab);

    expect(out.ok && out.shots).toHaveLength(BROWSE_MAX_SHOTS);
    expect(out.ok && out.steps.at(-1)).toMatchObject({ ok: false });
  });

  it('stops at the deadline, closes the browser and reports the steps left', async () => {
    const tab = fakeTab({ waitFor: () => new Promise(() => undefined) });

    const out = await browse('https://shop.example/', [{ do: StepKind.Wait, selector: '.never' }, { do: StepKind.Screenshot }], async () => tab, { deadlineMs: 30 });

    expect(out).toMatchObject({ ok: true, stopped: expect.stringContaining('time') });
    expect(tab.close).toHaveBeenCalled();
    expect(tab.shot).not.toHaveBeenCalled();
  });

  it('says why when the browser cannot open', async () => {
    expect(await browse('https://shop.example/', [], async () => Promise.reject(new Error('Browserless rate limit')))).toMatchObject({ ok: false, error: expect.stringContaining('rate limit') });
  });
});
