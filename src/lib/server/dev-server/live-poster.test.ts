import { describe, expect, it } from 'vitest';
import { captureLivePoster } from './live-poster';

const node = { id: 'n1', data: { live: { route: '/pricing', width: 390, poster: null } } };

describe('captureLivePoster', () => {
  it('fotografa la rotta alla larghezza del frame e la salva come poster', async () => {
    const shots: string[] = [];
    const written: unknown[] = [];
    const poster = await captureLivePoster('n1', {
      origin: 'http://localhost:3000',
      readNode: async () => node,
      capture: async (url, width) => {
        shots.push(`${url}@${width}`);
        return new Uint8Array([1]);
      },
      saveImage: async () => 'asset-1',
      writeData: async (_id, data) => {
        written.push(data);
      }
    });
    expect(poster).toBe('asset-1');
    expect(shots).toEqual(['http://localhost:3000/pricing@390']);
    expect(written).toEqual([{ live: { route: '/pricing', width: 390, poster: 'asset-1' } }]);
  });

  it('rifiuta un nodo che non è un live frame', async () => {
    const deps = { origin: 'http://localhost:3000', readNode: async () => ({ id: 'x', data: {} }), capture: async () => new Uint8Array(), saveImage: async () => '', writeData: async () => {} };
    await expect(captureLivePoster('x', deps)).rejects.toThrow(/not a live frame/);
  });
});
