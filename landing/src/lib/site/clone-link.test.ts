import { describe, expect, it } from 'vitest';
import { cloneLink } from './clone-link';

describe('clone link from the hero field', () => {
  it('normalises a bare domain and sends it to the app', () => {
    expect(cloneLink('  stripe.com ')).toBe(`https://oh.feega.app/app?start_url=${encodeURIComponent('https://stripe.com/')}`);
  });

  it('keeps an explicit http(s) url with its path', () => {
    expect(cloneLink('https://linear.app/pricing')).toBe(`https://oh.feega.app/app?start_url=${encodeURIComponent('https://linear.app/pricing')}`);
  });

  it('refuses what is not a public web address', () => {
    for (const bad of ['', 'hello', 'javascript:alert(1)', 'ftp://x.com', 'localhost:3000']) {
      expect(cloneLink(bad), bad).toBeNull();
    }
  });
});
