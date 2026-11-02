import { describe, expect, it } from 'vitest';
import { NodeFlag, flagHeld, flagsOf, toggledFlags } from './node-flags';

const NODES = [
  { id: 'g', data: { hidden: true } },
  { id: 'a', data: { groupId: 'g' } },
  { id: 'b', data: { locked: true } },
  { id: 'c', data: {} }
];

describe('node flags', () => {
  it('reads hidden and locked from data, false when absent', () => {
    expect(flagsOf({ hidden: true })).toEqual({ [NodeFlag.Hidden]: true, [NodeFlag.Locked]: false });
    expect(flagsOf({ locked: 'yes' })).toEqual({ [NodeFlag.Hidden]: false, [NodeFlag.Locked]: false });
  });

  it('a member of a hidden group is hidden too', () => {
    expect(flagHeld(NODES, 'a', NodeFlag.Hidden)).toBe(true);
    expect(flagHeld(NODES, 'c', NodeFlag.Hidden)).toBe(false);
    expect(flagHeld(NODES, 'b', NodeFlag.Locked)).toBe(true);
  });

  it('turns the flag on unless every pick already has it', () => {
    expect(toggledFlags(NODES, ['b', 'c'], NodeFlag.Locked)).toEqual([{ id: 'b', patch: { locked: true } }, { id: 'c', patch: { locked: true } }]);
    expect(toggledFlags(NODES, ['b'], NodeFlag.Locked)).toEqual([{ id: 'b', patch: { locked: false } }]);
    expect(toggledFlags(NODES, ['missing'], NodeFlag.Hidden)).toEqual([]);
  });
});
