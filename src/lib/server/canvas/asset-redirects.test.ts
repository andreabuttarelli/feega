import { describe, expect, it } from 'vitest';
import { redirectMemo } from './asset-redirects';

describe('redirect memo', () => {
  it('ricorda un redirect finché non scade, poi lo dimentica', () => {
    let clock = 0;
    const memo = redirectMemo(10, () => clock);

    memo.keep('u1|c1|a1|512', 'https://signed.example/a1');
    clock = 9_999;
    expect(memo.recall('u1|c1|a1|512')).toBe('https://signed.example/a1');

    clock = 10_000;
    expect(memo.recall('u1|c1|a1|512')).toBeNull();
  });

  it('un altro utente non eredita il redirect di un collega', () => {
    const memo = redirectMemo(10, () => 0);
    memo.keep('u1|c1|a1|512', 'https://signed.example/a1');
    expect(memo.recall('u2|c1|a1|512')).toBeNull();
  });
});
