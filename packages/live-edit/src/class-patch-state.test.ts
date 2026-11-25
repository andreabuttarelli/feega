import { describe, expect, it } from 'vitest';
import { stylePatch } from './class-patch';
import { ElementState } from './element-state';
import { LiveProp } from './live-fields';

const AT = { file: 'src/Button.tsx', line: 1, col: 1 };

async function classOf(open: string, state: ElementState, value: string) {
  const out = await stylePatch(async () => `${open}\n`, AT, { prop: LiveProp.Fill, value, state });
  return out.files[0]?.after.match(/className="([^"]*)"/)?.[1];
}

describe('tailwind edits in a state', () => {
  it('adds the utility behind the state variant', async () => {
    expect(await classOf('<button className="bg-white p-2">', ElementState.Hover, 'red-500')).toBe('bg-white p-2 hover:bg-red-500');
  });

  it('replaces a conflicting utility of the same variant only', async () => {
    expect(await classOf('<button className="bg-white hover:bg-blue-500 hover:p-2">', ElementState.Hover, 'red-500')).toBe('bg-white hover:bg-red-500 hover:p-2');
  });

  it('leaves the default and other states alone', async () => {
    expect(await classOf('<button className="bg-white focus:bg-blue-500">', ElementState.Hover, 'red-500')).toBe('bg-white focus:bg-blue-500 hover:bg-red-500');
  });

  it('does not touch a state utility when editing the default', async () => {
    expect(await classOf('<button className="hover:bg-blue-500">', ElementState.Default, 'red-500')).toBe('hover:bg-blue-500 bg-red-500');
  });

  it('resets only the state utility', async () => {
    expect(await classOf('<button className="bg-white hover:bg-blue-500">', ElementState.Hover, '')).toBe('bg-white');
  });

  it('never writes an empty arbitrary value', async () => {
    const out = await stylePatch(async () => '<button className="bg-white">\n', AT, { prop: LiveProp.Fill, value: '[]', state: ElementState.Hover });

    expect(out).toEqual({ files: [], skipped: [] });
  });

  it('writes focus-visible and disabled variants', async () => {
    expect(await classOf('<button className="p-2">', ElementState.FocusVisible, 'red-500')).toBe('p-2 focus-visible:bg-red-500');
    expect(await classOf('<button className="p-2">', ElementState.Disabled, 'red-500')).toBe('p-2 disabled:bg-red-500');
  });

  it('creates the class attribute when there is none', async () => {
    expect(await classOf('<button>', ElementState.Active, 'red-500')).toBe('active:bg-red-500');
  });
});
