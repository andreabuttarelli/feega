import { describe, expect, it } from 'vitest';
import { peakEnvelope, peakStore } from './peaks';

describe('peak envelope', () => {
  it('keeps the loudest sample of each bucket, scaled to the loudest of the file', () => {
    const samples = new Float32Array([0.1, -0.5, 0.25, 0, -0.2, 0.1]);

    expect(peakEnvelope(samples, 6, 3)).toEqual([1, 0.5, 0.4]);
  });

  it('silence stays flat, not divided by zero', () => {
    expect(peakEnvelope(new Float32Array(4), 4, 2)).toEqual([0, 0]);
  });

  it('a partial last bucket still counts', () => {
    expect(peakEnvelope(new Float32Array([1, 0, 0.5]), 2, 1)).toHaveLength(2);
  });
});

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v), items };
}

describe('peak store', () => {
  it('survives a reload through storage', () => {
    const storage = memoryStorage();
    peakStore(storage).put('a1', [0.123, 1]);

    expect(peakStore(storage).get('a1')).toEqual([0.12, 1]);
  });

  it('works from memory when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      }
    };
    const store = peakStore(broken);
    store.put('a1', [0.5]);

    expect(store.get('a1')).toEqual([0.5]);
    expect(peakStore(broken).get('a1')).toBeNull();
  });

  it('works with no storage at all', () => {
    const store = peakStore(null);
    store.put('a1', [1]);

    expect(store.get('a1')).toEqual([1]);
  });

  it('ignores a corrupt entry', () => {
    const storage = memoryStorage();
    storage.setItem('motion-peaks:v1:a1', '{not json');

    expect(peakStore(storage).get('a1')).toBeNull();
  });
});
