import { describe, expect, it } from 'vitest';
import { MARKETING_ORIGIN, landingUrlFor } from './marketing';

const on = (href: string) => landingUrlFor(new URL(href));

describe('landingUrlFor', () => {
  it.each(['/changelog', '/terms', '/privacy', '/cookies', '/ai-video-upscaler', '/ai-video-generator', '/ai-node-editor'])(
    'sends the marketing page %s to the landing, path kept',
    (path) => {
      expect(on(`https://oh.feega.app${path}`)).toBe(`${MARKETING_ORIGIN}${path}`);
    }
  );

  it('keeps the query string and ignores a trailing slash', () => {
    expect(on('https://oh.feega.app/changelog/?ref=x')).toBe(`${MARKETING_ORIGIN}/changelog?ref=x`);
  });

  it.each(['/', '/app', '/login', '/docs', '/docs/cli', '/p/abc', '/termsx'])('leaves the app path %s alone', (path) => {
    expect(on(`https://oh.feega.app${path}`)).toBeNull();
  });
});
