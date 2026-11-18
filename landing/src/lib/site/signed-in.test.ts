import { describe, expect, it } from 'vitest';
import { APP_URL } from './links';
import { FIRST_VISIT_SCRIPT, goesToApp, hasSignedInHint, homeHref } from './signed-in';

const BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
const visit = { path: '/', search: '', signedIn: true, seen: false, userAgent: BROWSER };

describe('a signed-in visitor on the landing', () => {
  it('goes to the app on the first visit to /', () => {
    expect(goesToApp(visit)).toBe(true);
  });

  it('stays once the first redirect happened', () => {
    expect(goesToApp({ ...visit, seen: true })).toBe(false);
  });

  it('stays when signed out', () => {
    expect(goesToApp({ ...visit, signedIn: false })).toBe(false);
  });

  it('stays on every other path', () => {
    for (const path of ['/changelog', '/compare', '/privacy', '/download/mac', '/index.html']) {
      expect(goesToApp({ ...visit, path }), path).toBe(false);
    }
  });

  it('stays with ?stay', () => {
    expect(goesToApp({ ...visit, search: '?stay' })).toBe(false);
  });

  it('never sends crawlers or link previews away', () => {
    const agents = [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'facebookexternalhit/1.1',
      'Twitterbot/1.0',
      'Slackbot-LinkExpanding 1.0',
      'WhatsApp/2.23',
      'Mozilla/5.0 (compatible; Discordbot/2.0)',
      'TelegramBot (like TwitterBot)',
      'LinkedInBot/1.0',
      'Mozilla/5.0 HeadlessChrome/120.0',
      'Chrome-Lighthouse'
    ];
    for (const userAgent of agents) {
      expect(goesToApp({ ...visit, userAgent }), userAgent).toBe(false);
    }
  });
});

describe('the signed-in hint cookie', () => {
  it('is read among other cookies', () => {
    expect(hasSignedInHint('a=1; feega_signed_in=1; b=2')).toBe(true);
    expect(hasSignedInHint('feega_signed_in=1')).toBe(true);
  });

  it('is absent otherwise', () => {
    expect(hasSignedInHint('')).toBe(false);
    expect(hasSignedInHint('not_feega_signed_in=1')).toBe(false);
    expect(hasSignedInHint('feega_signed_in=0')).toBe(false);
  });
});

describe('the site logo', () => {
  it('leads a signed-in visitor to the app', () => {
    expect(homeHref('feega_signed_in=1')).toBe(APP_URL);
  });

  it('leads a signed-out visitor home', () => {
    expect(homeHref('')).toBe('/');
  });
});

function runInline(env: { path: string; search?: string; cookie: string; stored?: string; userAgent?: string; storage?: 'broken' }) {
  const store = new Map<string, string>(env.stored ? [[env.stored, '1']] : []);
  const replaced: string[] = [];
  const localStorage = {
    getItem: (key: string) => {
      if (env.storage === 'broken') {
        throw new Error('blocked');
      }
      return store.get(key) ?? null;
    },
    setItem: (key: string, value: string) => void store.set(key, value)
  };
  const location = { pathname: env.path, search: env.search ?? '', replace: (url: string) => void replaced.push(url) };
  const run = new Function('location', 'localStorage', 'document', 'navigator', FIRST_VISIT_SCRIPT);
  run(location, localStorage, { cookie: env.cookie }, { userAgent: env.userAgent ?? BROWSER });
  return { replaced, store };
}

describe('the inline first-visit script', () => {
  it('redirects a signed-in first visit, then never again', () => {
    const first = runInline({ path: '/', cookie: 'feega_signed_in=1' });
    expect(first.replaced).toEqual([APP_URL]);

    const [key] = [...first.store.keys()];
    expect(runInline({ path: '/', cookie: 'feega_signed_in=1', stored: key }).replaced).toEqual([]);
  });

  it('leaves a signed-out visitor alone', () => {
    expect(runInline({ path: '/', cookie: '' }).replaced).toEqual([]);
  });

  it('does not redirect when it cannot remember the visit', () => {
    expect(runInline({ path: '/', cookie: 'feega_signed_in=1', storage: 'broken' }).replaced).toEqual([]);
  });
});

describe('first-visit tag on the home page', () => {
  it('is built in the module, so the page template never holds a script tag the compiler would parse', async () => {
    const { FIRST_VISIT_TAG } = await import('./signed-in');
    const { readFileSync } = await import('node:fs');
    const home = readFileSync('src/routes/+page.svelte', 'utf8');

    expect(FIRST_VISIT_TAG).toBe(`<script>${FIRST_VISIT_SCRIPT}</script>`);
    expect(home).not.toMatch(/`<script>/);
  });
});
