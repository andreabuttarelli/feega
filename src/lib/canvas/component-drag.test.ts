import { describe, expect, it } from 'vitest';
import { parseComponentDrag, serializeComponentDrag } from './component-drag';

describe('a component dragged from the Assets panel', () => {
  it('survives the trip through the browser drag data', () => {
    expect(parseComponentDrag(serializeComponentDrag({ frameId: 'f1', compId: 'c1' }))).toEqual({ frameId: 'f1', compId: 'c1' });
  });

  it('reads nothing from anything else that was dragged', () => {
    expect(parseComponentDrag('')).toBeNull();
    expect(parseComponentDrag('{"frameId":1}')).toBeNull();
    expect(parseComponentDrag('not json')).toBeNull();
  });
});
