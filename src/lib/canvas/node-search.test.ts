import { describe, expect, it } from 'vitest';
import { searchNodes } from './node-search';

const nodes = [
  { id: 'a', type: 'text', displayName: 'Hero copy', data: { prompt: 'write a tagline' } },
  { id: 'b', type: 'image', displayName: null, data: { prompt: 'red sneaker on concrete' } },
  { id: 'c', type: 'section', displayName: null, data: { title: 'Launch' } },
  { id: 'd', type: 'text', displayName: null, data: { text: 'Sneaker drop on friday' } }
];

describe('searchNodes', () => {
  it('finds by name', () => {
    expect(searchNodes(nodes, 'hero').map((n) => n.id)).toEqual(['a']);
  });

  it('finds by prompt and text, every word must match', () => {
    expect(searchNodes(nodes, 'sneaker').map((n) => n.id)).toEqual(['b', 'd']);
    expect(searchNodes(nodes, 'sneaker friday').map((n) => n.id)).toEqual(['d']);
  });

  it('finds a section by title', () => {
    expect(searchNodes(nodes, 'launch').map((n) => n.id)).toEqual(['c']);
  });

  it('returns nothing for an empty query', () => {
    expect(searchNodes(nodes, '  ')).toEqual([]);
  });
});
