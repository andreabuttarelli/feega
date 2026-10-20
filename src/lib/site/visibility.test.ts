import { describe, expect, it } from 'vitest';
import { SiteVisibility, rootShowsSite, siteVisibility } from './visibility';

describe('where the rebuilt marketing site is visible', () => {
  it('production keeps the site hidden until the flag is turned on', () => {
    expect(siteVisibility({ vercelEnv: 'production' })).toBe(SiteVisibility.Hidden);
    expect(siteVisibility({ vercelEnv: 'production', flag: 'false' })).toBe(SiteVisibility.Hidden);
  });

  it('the flag turns it on in production', () => {
    expect(siteVisibility({ vercelEnv: 'production', flag: 'true' })).toBe(SiteVisibility.Shown);
  });

  it.each(['preview', 'development', undefined])('a %s deploy shows it for testing', (vercelEnv) => {
    expect(siteVisibility({ vercelEnv })).toBe(SiteVisibility.Shown);
  });
});

describe('what / shows', () => {
  const at = (href: string) => new URL(href);

  it('production keeps / as the app entry everywhere until the flag is on', () => {
    expect(rootShowsSite(at('https://oh.feega.app/'), { vercelEnv: 'production' })).toBe(false);
    expect(rootShowsSite(at('https://www.feega.app/'), { vercelEnv: 'production' })).toBe(false);
  });

  it('with the flag on, only the site host shows the site at /', () => {
    expect(rootShowsSite(at('https://www.feega.app/'), { vercelEnv: 'production', flag: 'true' })).toBe(true);
    expect(rootShowsSite(at('https://oh.feega.app/'), { vercelEnv: 'production', flag: 'true' })).toBe(false);
  });

  it('a local deploy shows the site at /', () => {
    expect(rootShowsSite(at('http://localhost:5173/'), {})).toBe(true);
  });

  it('a preview deploy shows the site at /', () => {
    expect(rootShowsSite(at('https://feega-git-dev.vercel.app/'), { vercelEnv: 'preview' })).toBe(true);
  });
});
