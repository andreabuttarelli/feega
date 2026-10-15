import { describe, expect, it } from 'vitest';
import { SignInError, signInErrorIn } from './sign-in-error';

const at = (query: string) => signInErrorIn(new URL(`https://feega.app/login${query}`));

describe('signInErrorIn', () => {
  it('riconosce un accesso con provider fallito', () => {
    expect(at('?error=oauth')).toBe(SignInError.OAuth);
  });

  it('riconosce un link scaduto', () => {
    expect(at('?error=link')).toBe(SignInError.Link);
  });

  it('ignora valori sconosciuti e assenti', () => {
    expect(at('?error=boh')).toBeNull();
    expect(at('')).toBeNull();
  });
});
