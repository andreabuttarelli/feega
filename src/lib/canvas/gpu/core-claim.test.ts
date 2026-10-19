import { describe, expect, it } from 'vitest';
import { claimedByCore } from './core-claim';

const on = { on: true, refused: new Set<string>(), dom: new Set<string>() };

describe('claimedByCore — what Pixi must not load, decode or capture', () => {
  it('claims nothing while the core is off', () => {
    expect(claimedByCore({ id: 'a', kind: 'image' }, { ...on, on: false })).toBe(false);
    expect(claimedByCore({ id: 'f', kind: 'motion' }, { ...on, on: false })).toBe(false);
  });

  it('claims every node card before the core has drawn it, so no poster is fetched in the meantime', () => {
    expect(claimedByCore({ id: 'a', kind: 'image' }, on)).toBe(true);
    expect(claimedByCore({ id: 't', kind: 'text' }, on)).toBe(true);
  });

  it('claims rotated cards, the core turns their box', () => {
    expect(claimedByCore({ id: 'a', kind: 'image', rotation: 12 } as never, on)).toBe(true);
  });

  it('hands back a card the core refused, e.g. over its texture budget', () => {
    expect(claimedByCore({ id: 'a', kind: 'image' }, { ...on, refused: new Set(['a']) })).toBe(false);
  });

  it('leaves DOM-handed tiles and non-node tiles to Pixi', () => {
    expect(claimedByCore({ id: 'a', kind: 'image' }, { ...on, dom: new Set(['a']) })).toBe(false);
    expect(claimedByCore({ id: 'g', kind: 'rect' }, on)).toBe(false);
    expect(claimedByCore({ id: 'g' }, on)).toBe(false);
  });

  it('claims a frame until the core refuses it for parts it cannot draw', () => {
    expect(claimedByCore({ id: 'f', kind: 'motion' }, on)).toBe(true);
    expect(claimedByCore({ id: 'f', kind: 'motion' }, { ...on, dom: new Set(['f']) })).toBe(true);
    expect(claimedByCore({ id: 'f', kind: 'motion' }, { ...on, refused: new Set(['f']) })).toBe(false);
  });
});
