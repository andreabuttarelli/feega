import { describe, expect, it } from 'vitest';
import { ChunkSender, type OverlayChunk } from './core-overlay';
import type { PathItem } from './display-list';

const items = (clip: string) => [{ clip }] as unknown as PathItem[];

describe('ChunkSender', () => {
  it('sends every chunk and both orders the first time', () => {
    const a = items('a1');
    const b = items('b1');

    const ops = new ChunkSender().ops({ fixed: [{ key: 'a', items: a }], selected: [{ key: 'b', items: b }] });

    expect(ops).toEqual({ put: [['a', a], ['b', b]], drop: [], fixed: ['a'], selected: ['b'] });
  });

  it('moves a chunk between parts without resending its items', () => {
    const sender = new ChunkSender();
    const a: OverlayChunk = { key: 'a', items: items('a1') };
    const b: OverlayChunk = { key: 'b', items: items('b1') };
    sender.ops({ fixed: [a, b], selected: [] });

    const ops = sender.ops({ fixed: [a], selected: [{ ...b }] });

    expect(ops).toEqual({ put: [], drop: [], fixed: ['a'], selected: ['b'] });
  });

  it('resends only a chunk whose items changed, and no order that stayed', () => {
    const sender = new ChunkSender();
    const a: OverlayChunk = { key: 'a', items: items('a1') };
    sender.ops({ fixed: [a, { key: 'b', items: items('b1') }], selected: [] });
    const b2 = items('b2');

    const ops = sender.ops({ fixed: [a, { key: 'b', items: b2 }], selected: [] });

    expect(ops).toEqual({ put: [['b', b2]], drop: [] });
  });

  it('drops a chunk that left both parts and says nothing when nothing changed', () => {
    const sender = new ChunkSender();
    const a: OverlayChunk = { key: 'a', items: items('a1') };
    sender.ops({ fixed: [a, { key: 'b', items: items('b1') }], selected: [] });

    expect(sender.ops({ fixed: [a], selected: [] })).toEqual({ put: [], drop: ['b'], fixed: ['a'] });
    expect(sender.ops({ fixed: [a], selected: [] })).toBeNull();
  });
});
