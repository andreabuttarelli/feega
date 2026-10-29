import { describe, expect, it } from 'vitest';
import { Align, Direction, Sizing } from '../layout/auto-layout';
import { CodeTarget, exportCode } from './index';
import { box, DocKit } from './fixtures/kit';

function row() {
  const kit = new DocKit(1000, 500);
  kit.frame('row', { name: 'Row', box: box(0, 0, 1000, 200), layout: { direction: Direction.Horizontal }, item: { width: Sizing.Fixed, height: Sizing.Fixed } });
  kit.frame('wide', { name: 'Wide', parent: 'row', box: box(0, 0, 100, 100), item: { width: Sizing.Fill, widthGrow: 2 } });
  kit.frame('half', { name: 'Half', parent: 'row', box: box(0, 0, 100, 100), item: { width: Sizing.Percent, widthPercent: 50, alignSelf: Align.End } });
  kit.frame('pin', { name: 'Pin', parent: 'row', box: box(10, 10, 40, 40), item: { absolute: true } });
  return kit.doc();
}

const css = () =>
  exportCode(row(), { target: CodeTarget.Html, name: 'Row' })
    .files.filter((f) => f.path.endsWith('.css'))
    .map((f) => f.content)
    .join('\n');

describe('a stack child in code', () => {
  it('grows by its fill weight', () => {
    expect(css()).toMatch(/\.wide \{[^}]*flex: 2 1 0;/);
  });

  it('takes a percent of the stack', () => {
    expect(css()).toMatch(/\.half \{[^}]*width: 50%;/);
  });

  it('keeps its own align', () => {
    expect(css()).toMatch(/\.half \{[^}]*align-self: flex-end;/);
  });

  it('sits absolutely inside a relative stack', () => {
    expect(css()).toMatch(/\.row \{[^}]*position: relative;/);
    expect(css()).toMatch(/\.pin \{[^}]*position: absolute;/);
  });
});
