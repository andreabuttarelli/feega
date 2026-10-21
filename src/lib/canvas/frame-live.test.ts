import { describe, expect, it } from 'vitest';
import { editableIds, nextLive } from './frame-live';

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
  it('mounts every selected tile, frames included, since the inline editor stages on the frame tile', () => {
    expect([...editableIds(['frame', 'note'], 6)]).toEqual(['frame', 'note']);
  });

  it('caps the mounted tiles', () => {
    expect(editableIds(['frame', 'note'], 1).size).toBe(1);
  });
});
