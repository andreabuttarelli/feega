import { describe, expect, it } from 'vitest';
import { Layer, Why, factsOf, layerOf, signatureOf, undrawn, type Candidates, type Situation } from './core-debug';

const candidates: Candidates = { ready: { group: 'f:2' }, previous: { group: 'f:1' }, blocks: null, placeholder: { group: 'placeholder:frame:10x10' } };
const base: Situation = { onScreen: true, hidden: false, drawn: { group: 'f:2' }, ready: true, candidates };

describe('core debug facts', () => {
  it('names which layer was drawn', () => {
    expect(layerOf({ group: 'f:2' }, candidates)).toBe(Layer.Real);
    expect(layerOf({ group: 'f:1' }, candidates)).toBe(Layer.Previous);
    expect(layerOf({ group: 'placeholder:frame:10x10' }, candidates)).toBe(Layer.Placeholder);
    expect(layerOf(null, candidates)).toBe(Layer.None);
  });

  it('a real or previous picture on screen is drawn', () => {
    expect(factsOf('f', base).why).toBe(Why.Drawn);
    expect(factsOf('f', { ...base, drawn: { group: 'f:1' } }).why).toBe(Why.Drawn);
  });

  it('says why an on-screen node is not drawn', () => {
    expect(factsOf('f', { ...base, hidden: true }).why).toBe(Why.LiveEditor);
    expect(factsOf('f', { ...base, drawn: { group: 'placeholder:frame:10x10' } }).why).toBe(Why.NotUploaded);
    expect(factsOf('f', { ...base, drawn: null, ready: false }).why).toBe(Why.Evicted);
    expect(factsOf('f', { ...base, onScreen: false }).why).toBe(Why.Offscreen);
  });

  it('only on-screen nodes that are not drawn count, and the signature changes with them', () => {
    const facts = [factsOf('a', base), factsOf('b', { ...base, drawn: null, ready: false }), factsOf('c', { ...base, onScreen: false })];

    expect(undrawn(facts).map((f) => f.id)).toEqual(['b']);
    expect(signatureOf(facts)).toBe(`b:none:${Why.Evicted}`);
    expect(signatureOf([factsOf('a', base)])).toBe('');
  });
});
