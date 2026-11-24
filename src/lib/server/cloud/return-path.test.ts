import { describe, expect, it } from 'vitest';
import type { Cookies } from '@sveltejs/kit';
import { stashReturn, takeReturn } from './return-path';

function jar(): Cookies {
  const store = new Map<string, string>();

  return {
    get: (name: string) => store.get(name),
    set: (name: string, value: string) => void store.set(name, value),
    delete: (name: string) => void store.delete(name)
  } as unknown as Cookies;
}

describe('return path', () => {
  it('gives back a session path once', () => {
    const cookies = jar();
    stashReturn(cookies, '/s/abc?next=/x');

    expect(takeReturn(cookies)).toBe('/s/abc?next=/x');
    expect(takeReturn(cookies)).toBeNull();
  });

  it('refuses anything that is not a session path', () => {
    const cookies = jar();
    stashReturn(cookies, '//evil.com');

    expect(takeReturn(cookies)).toBeNull();
  });
});
