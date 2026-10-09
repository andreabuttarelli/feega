import { describe, expect, it } from 'vitest';
import { DEFAULT_ORIGIN } from './protocol.js';

describe('default origin', () => {
  it('is the embed host, not the homepage', () => {
    expect(DEFAULT_ORIGIN).toBe('https://oh.feega.app');
  });
});
