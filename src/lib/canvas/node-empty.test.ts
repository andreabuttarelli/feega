import { describe, expect, it } from 'vitest';
import { NODE_TYPES } from './node-data';
import { NODE_EMPTY_HINT } from './node-empty';

describe('NODE_EMPTY_HINT', () => {
  it('tells what to do next for every node type, so no node draws only a label', () => {
    for (const type of NODE_TYPES) {
      expect(NODE_EMPTY_HINT[type], type).toMatch(/\S/);
    }
  });
});
