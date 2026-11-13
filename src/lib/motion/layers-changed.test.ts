import { describe, expect, it } from 'vitest';
import { layersChanged } from './layers-changed';

const clip = (id: string, text = 'a') => ({ id, text });
const doc = (...clips: object[]) => ({ tracks: [{ id: 't', clips }] }) as unknown as Record<string, unknown>;

describe('layersChanged — how many layers an edit touched', () => {
  it('counts added, changed and removed layers', () => {
    expect(layersChanged(doc(clip('a'), clip('b'), clip('c')) as never, doc(clip('a'), clip('b', 'new'), clip('d'), clip('e')) as never)).toBe(4);
  });

  it('a whole new doc counts every layer in it', () => {
    expect(layersChanged(null, doc(clip('a'), clip('b'), clip('c')) as never)).toBe(3);
  });

  it('a change outside the layers counts one', () => {
    expect(layersChanged(doc(clip('a')) as never, { ...doc(clip('a')), fps: 60 } as never)).toBe(1);
  });

  it('a malformed doc never throws: it counts as one change, and the save refuses it later', () => {
    expect(layersChanged(null, { tracks: 'nope' } as never)).toBe(1);
    expect(layersChanged(null, { tracks: [{ clips: 'nope' }] } as never)).toBe(1);
  });

  it('counts layers inside compositions, nested ones included', () => {
    const comps = (n: number) => ({ Card: { name: 'Card', tracks: [{ id: 't', clips: Array.from({ length: n }, (_, i) => clip(`k${i}`)) }] }, Inner: { name: 'Inner', tracks: [{ id: 't', clips: [clip('i0')] }] } });
    expect(layersChanged({ ...doc(), comps: comps(1) } as never, { ...doc(), comps: comps(2000) } as never)).toBe(1999);
  });

  it('counts a changed component main as a layer', () => {
    const main = (name: string) => ({ Card: { name: 'Card', component: { name }, tracks: [] } });
    expect(layersChanged({ ...doc(), comps: main('A') } as never, { ...doc(), comps: main('B') } as never)).toBe(1);
  });

  it('counts a breakpoint override on a layer, and each changed breakpoint view', () => {
    expect(layersChanged(doc(clip('a')) as never, doc({ ...clip('a'), overrides: { mobile: { hidden: true } } }) as never)).toBe(1);
    expect(layersChanged({ ...doc(), breakpoints: [{ id: 'm', width: 390 }] } as never, { ...doc(), breakpoints: [{ id: 'm', width: 400 }, { id: 't', width: 768 }] } as never)).toBe(2);
  });

  it('counts each changed custom component', () => {
    expect(layersChanged({ ...doc(), components: { NodeGraph: { code: 'a' } } } as never, { ...doc(), components: { NodeGraph: { code: 'b' }, Chart: { code: 'c' } } } as never)).toBe(2);
  });

  it('the same doc counts nothing', () => {
    expect(layersChanged(doc(clip('a')) as never, doc(clip('a')) as never)).toBe(0);
  });
});
