import { describe, expect, it } from 'vitest';
import { Direction, siblingOf } from './siblings';

const order = ['front', 'middle', 'back'];

describe('Tab walks the siblings of the selection', () => {
  it('goes to the next and the previous layer, wrapping at the ends', () => {
    expect(siblingOf(order, ['front'], Direction.Next)).toBe('middle');
    expect(siblingOf(order, ['back'], Direction.Next)).toBe('front');
    expect(siblingOf(order, ['front'], Direction.Previous)).toBe('back');
  });

  it('with nothing selected Tab starts at the first layer', () => {
    expect(siblingOf(order, [], Direction.Next)).toBe('front');
  });

  it('a multi-selection moves on from its last layer', () => {
    expect(siblingOf(order, ['front', 'middle'], Direction.Next)).toBe('back');
  });

  it('no layers, nothing to select', () => {
    expect(siblingOf([], [], Direction.Next)).toBeNull();
  });
});
