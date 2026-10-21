import { describe, expect, it } from 'vitest';
import { CoreMode, editableIds, nextLive } from './frame-live';

describe('the frame running live on the canvas', () => {
  it('turns on the switched frame, and only that one', () => {
    expect(nextLive(null, 'a')).toBe('a');
    expect(nextLive('a', 'b')).toBe('b');
  });

  it('turns off when its own switch is pressed again', () => {
    expect(nextLive('a', 'a')).toBeNull();
  });
});

describe('the tiles a selection mounts as DOM', () => {
  const tiles = [
    { id: 'frame', kind: 'motion' },
    { id: 'note', kind: 'text' }
  ];

  it('leaves a selected frame to the core, so selecting it never swaps its drawing', () => {
    expect([...editableIds(['frame', 'note'], tiles, CoreMode.On, 6)]).toEqual(['note']);
  });

  it('mounts a selected frame without the core', () => {
    expect([...editableIds(['frame'], tiles, CoreMode.Off, 6)]).toEqual(['frame']);
  });

  it('caps the mounted tiles', () => {
    expect(editableIds(['frame', 'note'], tiles, CoreMode.Off, 1).size).toBe(1);
  });
});
