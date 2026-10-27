import { describe, expect, it } from 'vitest';
import { expandSectionEdges, sectionItemsOf, trimNote } from './section-source';
import type { UpstreamEdge } from './upstream-inputs';

const node = (id: string, type: string, data: Record<string, unknown> = {}) => ({ id, type, data });
const edge = (id: string, sourceNodeId: string, targetNodeId: string): UpstreamEdge => ({ id, sourceNodeId, targetNodeId });
const sources = (edges: UpstreamEdge[], target: string) => edges.filter((e) => e.targetNodeId === target).map((e) => e.sourceNodeId).sort();

const nodes = [
  node('s', 'section'),
  node('voice', 'text', { groupId: 's' }),
  node('pic', 'image', { groupId: 's' }),
  node('clip', 'video', { groupId: 's' }),
  node('gen', 'image', { groupId: 's' }),
  node('out', 'image')
];

describe('a section wired into a node', () => {
  it('hands the node everything the section holds and drops the section edge itself', () => {
    const edges = expandSectionEdges(nodes, [edge('e1', 's', 'out')]);

    expect(sources(edges, 'out')).toEqual(['clip', 'gen', 'pic', 'voice']);
  });

  it('fans out by member type whatever input port the section edge was dropped on', () => {
    const edges = expandSectionEdges(nodes, [{ ...edge('e1', 's', 'out'), targetHandle: 'first_frame' }]);

    expect(edges.filter((e) => e.targetNodeId === 'out').every((e) => e.targetHandle === null)).toBe(true);
  });

  it('leaves out the consuming node when it sits inside the section', () => {
    const edges = expandSectionEdges(nodes, [edge('e1', 's', 'gen')]);

    expect(sources(edges, 'gen')).toEqual(['clip', 'pic', 'voice']);
  });

  it('keeps an explicit edge once, not twice', () => {
    const edges = expandSectionEdges(nodes, [edge('e1', 's', 'out'), edge('e2', 'pic', 'out')]);

    expect(sources(edges, 'out').filter((id) => id === 'pic')).toHaveLength(1);
  });

  it('skips the items the consuming node excluded', () => {
    const withExclusion = nodes.map((n) => (n.id === 'out' ? node('out', 'image', { sectionExcluded: ['clip'] }) : n));
    const edges = expandSectionEdges(withExclusion, [edge('e1', 's', 'out')]);

    expect(sources(edges, 'out')).toEqual(['gen', 'pic', 'voice']);
  });

  it('picks up a node added to the section and loses one that left', () => {
    const next = [...nodes.filter((n) => n.id !== 'pic'), node('late', 'text', { groupId: 's' })];
    const edges = expandSectionEdges(next, [edge('e1', 's', 'out')]);

    expect(sources(edges, 'out')).toEqual(['clip', 'gen', 'late', 'voice']);
  });

  it('never closes a loop between two nodes inside the section that both read it', () => {
    const edges = expandSectionEdges(nodes, [edge('e1', 's', 'gen'), edge('e2', 's', 'pic')]);

    expect(sources(edges, 'gen')).toContain('pic');
    expect(sources(edges, 'pic')).not.toContain('gen');
  });

  it('lists the items a section offers a node, with the excluded ones flagged', () => {
    const withExclusion = nodes.map((n) => (n.id === 'out' ? node('out', 'image', { sectionExcluded: ['clip'] }) : n));

    expect(sectionItemsOf(withExclusion, 's', 'out')).toEqual([
      { id: 'voice', type: 'text', included: true },
      { id: 'pic', type: 'image', included: true },
      { id: 'clip', type: 'video', included: false },
      { id: 'gen', type: 'image', included: true }
    ]);
  });
});

describe('the note when a model takes fewer images than the section holds', () => {
  it('says how many are sent', () => {
    expect(trimNote(5, 3)).toBe('Only the first 3 of 5 images are sent: this model takes at most 3 references.');
  });

  it('stays quiet when they all fit', () => {
    expect(trimNote(3, 3)).toBeNull();
  });
});
