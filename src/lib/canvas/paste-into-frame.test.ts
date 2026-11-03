import { describe, expect, it } from 'vitest';
import { ElementPaste, elementPaste, pasteTargets } from './paste-into-frame';

const frame = { id: 'f', takesDrops: true };
const tile = { id: 't', takesDrops: false };

describe('pasting copied free elements', () => {
  it('goes into the one frame selected', () => {
    expect(pasteTargets([frame], ['e1'])).toEqual(['f']);
  });

  it('stays on the canvas without a single selected frame', () => {
    expect(pasteTargets([], ['e1'])).toEqual([]);
    expect(pasteTargets([tile], ['e1'])).toEqual([]);
  });

  it('goes into every frame selected, one copy each', () => {
    expect(pasteTargets([frame, { ...frame, id: 'g' }, tile], ['e1'])).toEqual(['f', 'g']);
  });

  it('stays on the canvas when nothing copied is a free element', () => {
    expect(pasteTargets([frame], [])).toEqual([]);
  });

  it('never pastes an element into itself', () => {
    expect(pasteTargets([frame], ['f'])).toEqual([]);
  });
});

describe('pasting elements copied out of a frame', () => {
  it('lands where the pointer is when the pointer is inside a selected frame', () => {
    expect(elementPaste(['f'], 'f')).toBe(ElementPaste.AtPoint);
  });

  it('goes into the one selected frame when the pointer is elsewhere, never loose on the canvas', () => {
    expect(elementPaste(['f'], null)).toBe(ElementPaste.IntoFrames);
    expect(elementPaste(['f'], 'other')).toBe(ElementPaste.IntoFrames);
  });

  it('goes into every selected frame', () => {
    expect(elementPaste(['f', 'g'], 'f')).toBe(ElementPaste.IntoFrames);
  });

  it('lands where the pointer is when no frame is selected', () => {
    expect(elementPaste([], null)).toBe(ElementPaste.AtPoint);
  });
});
