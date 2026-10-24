import { describe, expect, it } from 'vitest';
import { extraChromiumArgs } from './chromium-args';

describe('extraChromiumArgs', () => {
  it('splits CHROMIUM_ARGS on whitespace so a container can pass --no-sandbox', () => {
    expect(extraChromiumArgs({ CHROMIUM_ARGS: '--no-sandbox  --disable-gpu' })).toEqual(['--no-sandbox', '--disable-gpu']);
  });

  it('adds nothing when unset or blank', () => {
    expect(extraChromiumArgs({})).toEqual([]);
    expect(extraChromiumArgs({ CHROMIUM_ARGS: '   ' })).toEqual([]);
  });
});
