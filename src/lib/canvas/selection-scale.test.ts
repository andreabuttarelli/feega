import { describe, expect, it } from 'vitest';
import { copyPlan, type CopiedNode } from './duplicate-plan';
import { SECTION_TYPE, membershipAfter, withMembers } from './section';
import { counted } from './counted-list.testkit';

const SIZE = 2000;
const names = Array.from({ length: SIZE }, (_, i) => `n${i}`);
const text = (id: string): CopiedNode => ({ id, type: 'text', data: {}, x: 0, y: 0 });

describe('selection work indexes the ids once', () => {
  it('copying a whole selection scans no list per node', () => {
    const ids = counted(names);

    const plan = copyPlan({ ids, nodes: names.map(text), edges: [], offset: { dx: 1, dy: 1 } });

    expect(plan.nodes).toHaveLength(SIZE);
    expect(ids.scans()).toBe(0);
  });

  it('collecting what a delete takes scans no list per node', () => {
    const ids = counted(names);
    const nodes = [...names.map((id) => ({ id, type: 'text', data: {} })), { id: 's', type: SECTION_TYPE, data: {} }];

    withMembers(nodes, ids);

    expect(ids.scans()).toBe(0);
  });

  it('dropping many nodes finds each one without scanning the node list', () => {
    const nodes = counted(names.map((id) => ({ id, type: 'text', data: {}, x: 0, y: 0, w: 10, h: 10 })));
    const moves = names.map((id) => ({ id, x: 5, y: 5 }));

    membershipAfter(nodes, moves);

    expect(nodes.scans()).toBe(0);
  });
});
