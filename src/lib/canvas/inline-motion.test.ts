import { describe, expect, it } from 'vitest';
import { inlineMotionTarget } from './inline-motion';

const rows = [
  { id: 'm1', type: 'motion' },
  { id: 'm2', type: 'motion' },
  { id: 't1', type: 'text' }
];

describe('inline motion target', () => {
  it('opens the editor for exactly one selected motion node', () => {
    expect(inlineMotionTarget(['m1'], rows, null)).toBe('m1');
  });

  it('stays closed for anything else selected, or more than one node', () => {
    expect(inlineMotionTarget([], rows, null)).toBeNull();
    expect(inlineMotionTarget(['t1'], rows, null)).toBeNull();
    expect(inlineMotionTarget(['m1', 'm2'], rows, null)).toBeNull();
  });

  it('stays closed for the node dismissed with Esc until another is picked', () => {
    expect(inlineMotionTarget(['m1'], rows, 'm1')).toBeNull();
    expect(inlineMotionTarget(['m2'], rows, 'm1')).toBe('m2');
  });
});
