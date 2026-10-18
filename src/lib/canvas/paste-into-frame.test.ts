import { describe, expect, it } from 'vitest';
import { pasteIntoFrame } from './paste-into-frame';

const frame = { id: 'f', takesDrops: true };
const tile = { id: 't', takesDrops: false };

describe('pasting copied free elements', () => {
  it('goes into the one frame selected', () => {
    expect(pasteIntoFrame([frame], ['e1'])).toBe('f');
  });

  it('stays on the canvas without a single selected frame', () => {
    expect(pasteIntoFrame([], ['e1'])).toBeNull();
    expect(pasteIntoFrame([tile], ['e1'])).toBeNull();
    expect(pasteIntoFrame([frame, { ...frame, id: 'g' }], ['e1'])).toBeNull();
  });

  it('stays on the canvas when nothing copied is a free element', () => {
    expect(pasteIntoFrame([frame], [])).toBeNull();
  });

  it('never pastes an element into itself', () => {
    expect(pasteIntoFrame([frame], ['f'])).toBeNull();
  });
});
