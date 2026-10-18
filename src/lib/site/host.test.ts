import { describe, expect, it } from 'vitest';
import { isSiteHost } from './host';

describe('the marketing site host', () => {
  it.each(['www.feega.app', 'feega.app', 'WWW.Feega.App'])('%s serves the site', (host) => {
    expect(isSiteHost(new URL(`https://${host}/`))).toBe(true);
  });

  it.each(['oh.feega.app', 'localhost', 'feega-git-dev.vercel.app'])('%s serves the app', (host) => {
    expect(isSiteHost(new URL(`https://${host}/`))).toBe(false);
  });
});
