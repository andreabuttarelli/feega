import { describe, expect, it } from 'vitest';
import { ATTACH_RULE, AttachRule, NO_ATTACH_MESSAGE, attachRefusal } from './attach-rule';
import { Framework } from './run-plan';

const FEEGA_ONLY = [Framework.Astro, Framework.Nuxt];

describe('attach rule', () => {
  it('has a row for every framework', () => {
    expect(Object.keys(ATTACH_RULE).sort()).toEqual(Object.values(Framework).sort());
  });

  it.each(FEEGA_ONLY)('%s requires Feega to start the dev server', (framework) => {
    expect(ATTACH_RULE[framework].attach).toBe(AttachRule.RequiresFeegaStart);
    expect(attachRefusal(framework)).toBe(NO_ATTACH_MESSAGE);
  });

  it.each(Object.values(Framework).filter((f) => !FEEGA_ONLY.includes(f)))('%s may attach', (framework) => {
    expect(ATTACH_RULE[framework].attach).toBe(AttachRule.Allowed);
    expect(attachRefusal(framework)).toBeNull();
  });

  it('the message says why and what to do', () => {
    expect(NO_ATTACH_MESSAGE).toBe('Astro/Nuxt: Feega must start the dev server to link elements to your source files. Stop your running server or let Feega start its own.');
  });
});
