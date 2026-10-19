import { describe, expect, it } from 'vitest';
import { SiteVisibility, siteVisibility } from './visibility';

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
