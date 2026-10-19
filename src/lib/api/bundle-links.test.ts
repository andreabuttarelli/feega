import { describe, expect, it } from 'vitest';
import { webPageUrl } from './bundle-links';

const WEB = 'https://feega.app';

describe('in the bundle, public web pages open on the web', () => {
  it('a link to a public page goes to the web host, query kept', () => {
    for (const path of ['/changelog', '/report', '/gallery', '/gallery/g1', '/privacy', '/terms', '/docs/api']) {
      expect(webPageUrl(path, WEB), path).toBe(`${WEB}${path}`);
    }
    expect(webPageUrl('/report?about=x', WEB)).toBe(`${WEB}/report?about=x`);
  });

  it('an app page stays in the bundle', () => {
    for (const path of ['/app', '/app/canvases', '/p/p1/c/c1', '/login']) {
      expect(webPageUrl(path, WEB), path).toBeNull();
    }
  });
});
