import { describe, expect, it } from 'vitest';
import { componentClipText, parseComponentClip, parseComponentDrag, serializeComponentDrag } from './component-drag';

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

describe('a component copied from the Components panel', () => {
  it('pastes back from the clipboard text', () => {
    expect(parseComponentClip(componentClipText({ frameId: 'f1', compId: 'c1' }))).toEqual({ frameId: 'f1', compId: 'c1' });
  });

  it('ignores any other clipboard text', () => {
    expect(parseComponentClip('hello')).toBeNull();
    expect(parseComponentClip('')).toBeNull();
  });
});
