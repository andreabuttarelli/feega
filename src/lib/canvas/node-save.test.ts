import { describe, expect, it, vi } from 'vitest';
import { SaveFailure, adoptIdleRows, failureOf, isOwnEcho, keepDirty, saveMessage, writeWithRetry } from './node-save';

describe('failureOf: every server answer has one reason', () => {
  it.each([
    [{ type: 'failure', status: 409, data: { conflict: true } }, SaveFailure.Conflict],
    [{ type: 'failure', status: 400, data: { error: 'contenuto non valido' } }, SaveFailure.Invalid],
    [{ type: 'failure', status: 404, data: { error: 'nodo non trovato' } }, SaveFailure.Gone],
    [{ type: 'failure', status: 402, data: { error: 'credits_exhausted', message: 'Out' } }, SaveFailure.Credits],
    [{ type: 'redirect', status: 303, location: '/login' }, SaveFailure.Auth],
    [{ type: 'error', status: 500, error: { message: 'boom' } }, SaveFailure.Server],
    [{ type: 'failure', status: 403, data: {} }, SaveFailure.Auth],
    [{ type: 'network' }, SaveFailure.Network]
  ])('%j → %s', (result, reason) => {
    expect(failureOf(result)).toBe(reason);
  });

  it('a message for every reason, never the generic one', () => {
    for (const reason of Object.values(SaveFailure)) {
      expect(saveMessage(reason)).toMatch(/\w/);
      expect(saveMessage(reason)).not.toMatch(/non salvato|^not saved$/i);
    }
  });

  it('credits keep the server message', () => {
    expect(saveMessage(SaveFailure.Credits, { message: 'You need 12 credits' })).toBe('You need 12 credits');
  });
});

type Tile = { id: string; version: number; data: Record<string, unknown> };

describe('adoptIdleRows: a dropped snapshot still advances idle nodes', () => {
  it('il refresh scartato mentre un altro salvataggio è in volo non lascia la versione indietro', () => {
    const local: Tile[] = [
      { id: 'a', version: 3, data: { prompt: 'old' } },
      { id: 'b', version: 5, data: { prompt: 'typing' } }
    ];
    const server = [
      { id: 'a', version: 4, data: { prompt: 'old', status: 'done' } },
      { id: 'b', version: 6, data: { prompt: 'other' } }
    ];

    const next = adoptIdleRows(local, server, (id) => (id === 'b' ? ['prompt'] : []));

    expect(next[0]).toEqual({ id: 'a', version: 4, data: { prompt: 'old', status: 'done' }, saved: { prompt: 'old', status: 'done' } });
    expect(next[1]).toEqual({ id: 'b', version: 6, data: { prompt: 'typing' }, saved: { prompt: 'other' } });
  });

  it('a remote update merges other fields and never overwrites the one being typed', () => {
    const local: Tile[] = [{ id: 'a', version: 3, data: { prompt: 'hello wor', model: 'm1' } }];
    const server = [{ id: 'a', version: 4, data: { prompt: 'hello', model: 'm2' } }];

    const next = adoptIdleRows(local, server, () => ['prompt']);

    expect(next[0].data).toEqual({ prompt: 'hello wor', model: 'm2' });
    expect(next[0].version).toBe(4);
  });

  it('never moves a version backwards', () => {
    const local: Tile[] = [{ id: 'a', version: 9, data: {} }];
    expect(adoptIdleRows(local, [{ id: 'a', version: 7, data: { x: 1 } }], () => [])).toEqual(local);
  });
});

describe('keepDirty: a full snapshot keeps unsent edits', () => {
  it('overlays the local value of every dirty field on the fresh tile', () => {
    const local: Tile[] = [{ id: 'a', version: 3, data: { prompt: 'typed', index: 2 } }];
    const fresh: Tile[] = [
      { id: 'a', version: 4, data: { prompt: 'stale', index: 5 } },
      { id: 'b', version: 1, data: { prompt: 'new' } }
    ];

    const next = keepDirty(fresh, local, (id) => (id === 'a' ? ['prompt'] : []));

    expect(next[0].data).toEqual({ prompt: 'typed', index: 5 });
    expect(next[1]).toBe(fresh[1]);
  });
});

describe('isOwnEcho: realtime does not refetch what this tab just wrote', () => {
  const tiles: Tile[] = [{ id: 'a', version: 5, data: {} }];
  const update = (version: number, table = 'nodes') =>
    ({ table, eventType: 'UPDATE', new: { id: 'a', version } }) as const;

  it('ignores an update the tab already holds', () => {
    expect(isOwnEcho(update(5), tiles, () => false)).toBe(true);
  });

  it('ignores an update on a node whose save is in flight', () => {
    expect(isOwnEcho(update(6), tiles, (id) => id === 'a')).toBe(true);
  });

  it('refetches a newer update from someone else', () => {
    expect(isOwnEcho(update(6), tiles, () => false)).toBe(false);
  });

  it('refetches inserts, deletes and connections', () => {
    expect(isOwnEcho({ table: 'nodes', eventType: 'INSERT', new: { id: 'z', version: 1 } }, tiles, () => false)).toBe(false);
    expect(isOwnEcho(update(1, 'nodes_connections'), tiles, () => false)).toBe(false);
  });
});

describe('writeWithRetry: a conflict reapplies the edit on the fresh row', () => {
  it('rereads, takes the fresh values as base, and sends the same patch once more', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ type: 'failure', status: 409, data: { conflict: true } })
      .mockResolvedValueOnce({ type: 'success', status: 200, data: { node: { id: 'a', version: 8, data: { status: 'done', prompt: 'mine' } } } });
    const reread = vi.fn().mockResolvedValue({ status: 'done', prompt: 'theirs' });

    const out = await writeWithRetry({ send, reread, patch: { prompt: 'mine' }, base: { prompt: 'old' } });

    expect(send).toHaveBeenNthCalledWith(1, { prompt: 'mine' }, { prompt: 'old' });
    expect(send).toHaveBeenNthCalledWith(2, { prompt: 'mine' }, { prompt: 'theirs' });
    expect(out).toEqual({ ok: true, node: { id: 'a', version: 8, data: { status: 'done', prompt: 'mine' } } });
  });

  it('a second conflict is reported, with the edit still in hand', async () => {
    const conflict = { type: 'failure', status: 409, data: { conflict: true } };
    const send = vi.fn().mockResolvedValue(conflict);
    const reread = vi.fn().mockResolvedValue({});

    const out = await writeWithRetry({ send, reread, patch: { prompt: 'mine' }, base: {} });

    expect(send).toHaveBeenCalledTimes(2);
    expect(out).toMatchObject({ ok: false, reason: SaveFailure.Conflict, patch: { prompt: 'mine' } });
  });

  it('any other failure is not retried', async () => {
    const send = vi.fn().mockResolvedValue({ type: 'failure', status: 400, data: { error: 'x' } });
    const reread = vi.fn();

    const out = await writeWithRetry({ send, reread, patch: {}, base: {} });

    expect(reread).not.toHaveBeenCalled();
    expect(out).toMatchObject({ ok: false, reason: SaveFailure.Invalid });
  });
});
