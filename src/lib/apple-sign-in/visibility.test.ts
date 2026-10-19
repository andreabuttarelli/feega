import { describe, expect, it } from 'vitest';
import { appleSignInShown, AppleSignInFlag } from './visibility';

const SAFARI = 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15';
const NATIVE = 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 FeegaNative/0.1.0';

describe('Sign in with Apple visibility', () => {
  it.each([
    ['oh.feega.app', NATIVE, AppleSignInFlag.On],
    ['feega.app', NATIVE, AppleSignInFlag.On],
    ['www.feega.app', SAFARI, AppleSignInFlag.On],
    ['oh.feega.app', SAFARI, AppleSignInFlag.Off]
  ])('production never shows it (%s)', (host, userAgent, flag) => {
    expect(appleSignInShown({ host, userAgent, flag })).toBe(false);
  });

  it.each(['localhost:5173', '127.0.0.1:5191', 'mac.local'])('a local host shows it (%s)', (host) => {
    expect(appleSignInShown({ host, userAgent: SAFARI, flag: AppleSignInFlag.Off })).toBe(true);
  });

  it('a preview host shows it only to a native build with the flag on', () => {
    const host = 'feega-git-dev.vercel.app';
    expect(appleSignInShown({ host, userAgent: NATIVE, flag: AppleSignInFlag.On })).toBe(true);
    expect(appleSignInShown({ host, userAgent: NATIVE, flag: AppleSignInFlag.Off })).toBe(false);
    expect(appleSignInShown({ host, userAgent: SAFARI, flag: AppleSignInFlag.On })).toBe(false);
  });
});
