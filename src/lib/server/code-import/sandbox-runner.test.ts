import { describe, expect, it } from 'vitest';
import { IMPORT_KEY_COOKIE } from './origin-proxy';
import { curlProbe, importKey, quoted } from './sandbox-runner';

describe('quoted', () => {
  it('a plan argument reaches bash as one literal word', () => {
    expect(quoted('@yarnpkg/cli-dist@4.5.1')).toBe("'@yarnpkg/cli-dist@4.5.1'");
    expect(quoted("it's; rm -rf /")).toBe("'it'\\''s; rm -rf /'");
  });
});

describe('the import key', () => {
  it('is fresh and unguessable for every import', () => {
    const [a, b] = [importKey(), importKey()];

    expect(a).toMatch(/^[0-9a-f]{48}$/);
    expect(a).not.toBe(b);
  });

  it('the readiness probe of the proxy carries it, the dev server probe does not', () => {
    expect(curlProbe(4173, 'abc')).toContain(`-H 'Cookie: ${IMPORT_KEY_COOKIE}=abc'`);
    expect(curlProbe(4174, null)).not.toContain('Cookie');
  });
});
