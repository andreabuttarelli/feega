import { describe, expect, it } from 'vitest';
import { styleAttr } from './style-attr';

const FILE = 'src/Card.svelte';
const at = (line: number) => ({ file: FILE, line, col: 3 });
const readOf = (text: string) => async () => text;
const SOURCE = `<div>
  <h1 class="title">Hi</h1>
  <p style="color: red; margin: 0">Text</p>
  <span style={dynamic}>x</span>
</div>
`;

const changed = (after: string) => after.split('\n').filter((l, i) => l !== SOURCE.split('\n')[i]);

describe('styleAttr', () => {
  it('adds a style attribute with the declarations', async () => {
    const out = await styleAttr(readOf(SOURCE), at(2), { 'font-weight': '700' });

    expect(out.ok && changed(out.change.after)).toEqual(['  <h1 class="title" style="font-weight: 700">Hi</h1>']);
  });

  it('replaces the same property and keeps the others', async () => {
    const out = await styleAttr(readOf(SOURCE), at(3), { color: '#0078d4', 'font-size': '20px' });

    expect(out.ok && changed(out.change.after)).toEqual(['  <p style="color: #0078d4; margin: 0; font-size: 20px">Text</p>']);
  });

  it('refuses a style that is an expression', async () => {
    const out = await styleAttr(readOf(SOURCE), at(4), { color: 'red' });

    expect(out.ok).toBe(false);
  });

  it('in JSX writes a style object', async () => {
    const out = await styleAttr(readOf('<h1 className="t">Hi</h1>\n'), { file: 'src/A.tsx', line: 1, col: 1 }, { 'font-weight': '700', 'padding-top': '8px' });

    expect(out.ok && out.change.after).toBe(`<h1 className="t" style={{ fontWeight: '700', paddingTop: '8px' }}>Hi</h1>\n`);
  });
});
