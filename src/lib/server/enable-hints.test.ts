import { describe, expect, it } from 'vitest';
import { enableHint } from './enable-hints';

describe('enableHint', () => {
  it.each([
    ['LLM_API_KEY is not configured', 'LLM_API_KEY'],
    ['llm_unconfigured', 'LLM_API_KEY'],
    ['STRIPE_SECRET_KEY is not set', 'STRIPE_SECRET_KEY'],
    ['RESEND_API_KEY not configured', 'RESEND_API_KEY']
  ])('turns "%s" into an instruction naming %s', (error, key) => {
    expect(enableHint(new Error(error))).toContain(key);
    expect(enableHint(new Error(error))).toMatch(/^Add .* to \.env to enable /);
  });

  it('stays silent about errors that are not a missing key', () => {
    expect(enableHint(new Error('HTTP 503'))).toBeNull();
    expect(enableHint('boom')).toBeNull();
  });
});
