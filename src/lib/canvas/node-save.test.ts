import { describe, expect, it, vi } from 'vitest';
import { SaveFailure, adoptIdleRows, failureOf, saveMessage, writeWithRetry } from './node-save';

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

    const next = adoptIdleRows(local, server, (id) => id === 'b');

    expect(next[0]).toEqual({ id: 'a', version: 4, data: { prompt: 'old', status: 'done' } });
    expect(next[1]).toEqual(local[1]);
  });

  it('never moves a version backwards', () => {
    const local: Tile[] = [{ id: 'a', version: 9, data: {} }];
    expect(adoptIdleRows(local, [{ id: 'a', version: 7, data: { x: 1 } }], () => false)).toEqual(local);
  });
});

describe('writeWithRetry: a conflict reapplies the edit on the fresh row', () => {
  it('rereads, merges the patch on top, and saves once more', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ type: 'failure', status: 409, data: { conflict: true } })
      .mockResolvedValueOnce({ type: 'success', status: 200, data: { node: { id: 'a', version: 8, data: { status: 'done', prompt: 'mine' } } } });
    const reread = vi.fn().mockResolvedValue({ version: 7, data: { status: 'done', prompt: 'theirs' } });

    const out = await writeWithRetry({ send, reread, version: 3, patch: { prompt: 'mine' }, data: { prompt: 'mine' } });

    expect(send).toHaveBeenNthCalledWith(2, 7, { status: 'done', prompt: 'mine' });
    expect(out).toEqual({ ok: true, node: { id: 'a', version: 8, data: { status: 'done', prompt: 'mine' } } });
  });

  it('a second conflict is reported, with the edit still in hand', async () => {
    const conflict = { type: 'failure', status: 409, data: { conflict: true } };
    const send = vi.fn().mockResolvedValue(conflict);
    const reread = vi.fn().mockResolvedValue({ version: 7, data: {} });

    const out = await writeWithRetry({ send, reread, version: 3, patch: { prompt: 'mine' }, data: { prompt: 'mine' } });

    expect(send).toHaveBeenCalledTimes(2);
    expect(out).toMatchObject({ ok: false, reason: SaveFailure.Conflict, data: { prompt: 'mine' } });
  });

  it('any other failure is not retried', async () => {
    const send = vi.fn().mockResolvedValue({ type: 'failure', status: 400, data: { error: 'x' } });
    const reread = vi.fn();

    const out = await writeWithRetry({ send, reread, version: 3, patch: {}, data: {} });

    expect(reread).not.toHaveBeenCalled();
    expect(out).toMatchObject({ ok: false, reason: SaveFailure.Invalid });
  });
});
