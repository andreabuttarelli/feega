import { describe, expect, it } from 'vitest';
import { Keep, mergeReject, type Side } from './reject-plan';

type Case = {
  name: string;
  before: Side;
  after: Side;
  current: Side;
  choices?: Record<string, Keep>;
  next: Side;
  reverted: string[];
  conflicts: string[];
};

const CASES: Case[] = [
  {
    name: 'untouched since the agent: the agent field goes back',
    before: { data: { prompt: 'a' } },
    after: { data: { prompt: 'b' } },
    current: { data: { prompt: 'b' } },
    next: { data: { prompt: 'a' } },
    reverted: ['data.prompt'],
    conflicts: []
  },
  {
    name: 'user changed a different field: it stays',
    before: { data: { prompt: 'a', model: 'm1' } },
    after: { data: { prompt: 'b', model: 'm1' } },
    current: { data: { prompt: 'b', model: 'm2' } },
    next: { data: { prompt: 'a', model: 'm2' } },
    reverted: ['data.prompt'],
    conflicts: []
  },
  {
    name: 'user changed the same field: conflict, nothing clobbered',
    before: { data: { prompt: 'a' } },
    after: { data: { prompt: 'b' } },
    current: { data: { prompt: 'c' } },
    next: { data: { prompt: 'c' } },
    reverted: [],
    conflicts: ['data.prompt']
  },
  {
    name: 'conflict resolved keep mine',
    before: { data: { prompt: 'a' } },
    after: { data: { prompt: 'b' } },
    current: { data: { prompt: 'c' } },
    choices: { 'data.prompt': Keep.Mine },
    next: { data: { prompt: 'c' } },
    reverted: [],
    conflicts: []
  },
  {
    name: 'conflict resolved take reject',
    before: { data: { prompt: 'a' } },
    after: { data: { prompt: 'b' } },
    current: { data: { prompt: 'c' } },
    choices: { 'data.prompt': Keep.Reject },
    next: { data: { prompt: 'a' } },
    reverted: ['data.prompt'],
    conflicts: []
  },
  {
    name: 'nested path: sibling edited by the user survives',
    before: { data: { style: { color: 'red', size: 1 } } },
    after: { data: { style: { color: 'blue', size: 1 } } },
    current: { data: { style: { color: 'blue', size: 9 } } },
    next: { data: { style: { color: 'red', size: 9 } } },
    reverted: ['data.style.color'],
    conflicts: []
  },
  {
    name: 'a field the agent added is removed',
    before: { data: {} },
    after: { data: { caption: 'new' } },
    current: { data: { caption: 'new' } },
    next: { data: {} },
    reverted: ['data.caption'],
    conflicts: []
  },
  {
    name: 'a field the agent removed comes back',
    before: { data: { caption: 'old' } },
    after: { data: {} },
    current: { data: {} },
    next: { data: { caption: 'old' } },
    reverted: ['data.caption'],
    conflicts: []
  },
  {
    name: 'user already put it back: nothing to do',
    before: { data: { prompt: 'a' } },
    after: { data: { prompt: 'b' } },
    current: { data: { prompt: 'a' } },
    next: { data: { prompt: 'a' } },
    reverted: [],
    conflicts: []
  },
  {
    name: 'position the agent moved goes back, data the user wrote stays',
    before: { position: { x: 0, y: 0 } },
    after: { position: { x: 100, y: 0 } },
    current: { position: { x: 100, y: 0 }, data: { prompt: 'mine' } },
    next: { position: { x: 0, y: 0 }, data: { prompt: 'mine' } },
    reverted: ['position.x'],
    conflicts: []
  },
  {
    name: 'user replaced the whole object the agent edited inside: conflict on the object',
    before: { data: { style: { color: 'red' } } },
    after: { data: { style: { color: 'blue' } } },
    current: { data: { style: 'none' } },
    next: { data: { style: 'none' } },
    reverted: [],
    conflicts: ['data.style']
  }
];

describe('mergeReject: revert only what the agent changed', () => {
  it.each(CASES)('$name', ({ before, after, current, choices, next, reverted, conflicts }) => {
    const merge = mergeReject(before, after, current, choices);

    expect(merge.next).toEqual(next);
    expect(merge.reverted).toEqual(reverted);
    expect(merge.conflicts.map((c) => c.path)).toEqual(conflicts);
  });

  it('a conflict says what each side holds', () => {
    const merge = mergeReject({ data: { prompt: 'a' } }, { data: { prompt: 'b' } }, { data: { prompt: 'c' } });

    expect(merge.conflicts).toEqual([{ path: 'data.prompt', mine: 'c', agent: 'b', original: 'a' }]);
  });
});
