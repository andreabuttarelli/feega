import { describe, expect, it } from 'vitest';
import { NODE_NAME_MAX, cleanNodeName } from './node-name';

describe('node name', () => {
  it('trims, caps the length and turns an empty name into null', () => {
    expect(cleanNodeName('  Hero  ')).toBe('Hero');
    expect(cleanNodeName('   ')).toBeNull();
    expect(cleanNodeName('x'.repeat(NODE_NAME_MAX + 5))).toHaveLength(NODE_NAME_MAX);
  });
});
