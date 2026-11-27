import { describe, expect, it } from 'vitest';
import { panelHtml } from './panel-html';

const html = panelHtml({ script: '/panel.js', style: '/panel.css', cspSource: "'self'", nonce: 'abc' });
const policy = html.match(/Content-Security-Policy" content="([^"]+)"/)![1];
const directive = (name: string) => policy.split('; ').find((d) => d.startsWith(`${name} `));

describe('panel content security policy', () => {
  it('lets plugin workers start from blobs and nothing else', () => {
    expect(directive('worker-src')).toBe('worker-src blob:');
  });

  it('keeps the network closed to everything but the local socket', () => {
    expect(directive('connect-src')).toBe("connect-src 'self' ws://localhost:* ws://127.0.0.1:*");
  });

  it('does not open to the icon CDNs: plugins download through the host', () => {
    expect(policy).not.toMatch(/jsdelivr|unpkg/);
  });

  it('loads no remote image', () => {
    expect(directive('img-src')).toBe("img-src 'self' data:");
  });

  it('only runs the panel script', () => {
    expect(directive('script-src')).toBe("script-src 'nonce-abc'");
  });
});
