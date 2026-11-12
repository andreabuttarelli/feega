import { describe, expect, it } from 'vitest';
import { quoted } from './sandbox-runner';

describe('quoted', () => {
  it('a plan argument reaches bash as one literal word', () => {
    expect(quoted('@yarnpkg/cli-dist@4.5.1')).toBe("'@yarnpkg/cli-dist@4.5.1'");
    expect(quoted("it's; rm -rf /")).toBe("'it'\\''s; rm -rf /'");
  });
});
