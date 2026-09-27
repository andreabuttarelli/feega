import { describe, expect, it } from 'vitest';
import { textRequest } from './text-request';

describe('textRequest', () => {
  it('usa prompt di sistema, richiesta locale e tutti i testi collegati', () => {
    const request = textRequest(['primo dato', 'secondo dato'], 'riassumi');

    expect(request.system).toBe('');
    expect(request.user).toContain('primo dato');
    expect(request.user).toContain('secondo dato');
    expect(request.user).toContain('riassumi');
  });
});
