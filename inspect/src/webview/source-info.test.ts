import { describe, expect, it } from 'vitest';
import type { LayerNode } from '../messages';
import { hasSourceInfo } from './source-info';

const node = (source: LayerNode['source'], children: LayerNode[] = []): LayerNode => ({ name: 'div', tag: 'div', display: 'block', direction: 'row', source, component: false, count: 1, children });

describe('hasSourceInfo', () => {
  it('is true when any layer, however deep, points at a source line', () => {
    expect(hasSourceInfo([node(null, [node(null, [node({ file: 'a.tsx', line: 1, col: 1 })])])])).toBe(true);
  });

  it('is false for a page where no layer has a source', () => {
    expect(hasSourceInfo([node(null, [node(null)])])).toBe(false);
  });

  it('is true while there are no layers yet, so nothing is claimed early', () => {
    expect(hasSourceInfo([])).toBe(true);
  });
});
