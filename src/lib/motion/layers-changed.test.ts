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

  it('the same doc counts nothing', () => {
    expect(layersChanged(doc(clip('a')) as never, doc(clip('a')) as never)).toBe(0);
  });
});
