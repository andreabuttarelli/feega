import { describe, expect, it } from 'vitest';
import { stylePatch } from './class-patch';
import { ElementState } from './element-state';
import { LiveProp } from './live-fields';

const AT = { file: 'src/Button.tsx', line: 1, col: 1 };

async function classOf(open: string, variant: string | undefined, value: string, state?: ElementState) {
  const out = await stylePatch(async () => `${open}\n`, AT, { prop: LiveProp.Fill, value, variant, state, viewport: 1400 });
  return out.files[0]?.after.match(/className="([^"]*)"/)?.[1];
}

describe('tailwind edits at a breakpoint', () => {
  it('prefixes the utility with the breakpoint', async () => {
    expect(await classOf('<div className="bg-white p-2">', 'md', 'red-500')).toBe('bg-white p-2 md:bg-red-500');
  });

  it('replaces only the same breakpoint, whatever the viewport', async () => {
    expect(await classOf('<div className="bg-white md:bg-blue-500 lg:bg-green-500">', 'md', 'red-500')).toBe('bg-white md:bg-red-500 lg:bg-green-500');
  });

  it('writes the base value for all sizes and leaves overrides', async () => {
    expect(await classOf('<div className="bg-white lg:bg-green-500">', '', 'red-500')).toBe('bg-red-500 lg:bg-green-500');
  });

  it('combines with a state', async () => {
    expect(await classOf('<div className="bg-white">', 'md', 'red-500', ElementState.Hover)).toBe('bg-white md:hover:bg-red-500');
  });

  it('writes a max- variant as is', async () => {
    expect(await classOf('<div className="p-2">', 'max-md', 'red-500')).toBe('p-2 max-md:bg-red-500');
  });

  it('creates the class attribute behind the breakpoint', async () => {
    expect(await classOf('<div>', 'lg', 'red-500')).toBe('lg:bg-red-500');
  });
});
