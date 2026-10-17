import { describe, expect, it } from 'vitest';
import { openOutbox, type Shelf } from './outbox';

function memoryShelf(): Shelf & { kept: Map<string, unknown> } {
  const kept = new Map<string, unknown>();
  return {
    kept,
    read: async (key) => kept.get(key),
    write: async (key, value) => { kept.set(key, value); }
  };
}

const broken: Shelf = {
  read: async () => { throw new Error('private window'); },
  write: async () => { throw new Error('quota'); }
};

describe('outbox: unsent work kept in the browser per user and canvas', () => {
  it('gives back what was saved, under the same user and canvas only', async () => {
    const shelf = memoryShelf();
    const mine = await openOutbox(shelf, 'user-1:canvas-1');
    await mine.save({ nodes: { a: { prompt: 'typed offline' } } });

    expect((await openOutbox(shelf, 'user-1:canvas-1')).nodes).toEqual({ a: { prompt: 'typed offline' } });
    expect((await openOutbox(shelf, 'user-2:canvas-1')).nodes).toEqual({});
  });

  it('keeps the parts not being saved', async () => {
    const shelf = memoryShelf();
    const box = await openOutbox(shelf, 'k');
    await box.save({ ops: [{ opId: '1', action: 'connect', fields: {} }] });
    await box.save({ nodes: { a: { x: 1 } } });

    const back = await openOutbox(shelf, 'k');
    expect(back.ops).toHaveLength(1);
    expect(back.nodes).toEqual({ a: { x: 1 } });
  });

  it('works empty and never throws when the browser refuses storage', async () => {
    const box = await openOutbox(broken, 'k');

    expect(box).toMatchObject({ ops: [], nodes: {}, places: [] });
    await expect(box.save({ nodes: {} })).resolves.toBeUndefined();
  });
});
