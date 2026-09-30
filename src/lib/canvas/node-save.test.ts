import { describe, expect, it, vi } from 'vitest';
import { SaveFailure, adoptIdleRows, failureOf, isOwnEcho, keepDirty, keepLocal, saveMessage, writeWithRetry } from './node-save';

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

  it('a snapshot read before a save landed never moves that node back, so saves never hold refreshes', () => {
    const local: Tile[] = [{ id: 'a', version: 7, data: { prompt: 'saved just now' } }];
    const fresh: Tile[] = [{ id: 'a', version: 6, data: { prompt: 'before the save' } }];

    expect(keepDirty(fresh, local, () => [])).toEqual(local);
  });
});

describe('isOwnEcho: realtime does not refetch what this tab just wrote', () => {
  const tiles = [{ id: 'a', version: 5, data: { prompt: 'hi' }, x: 10, y: 20, displayName: null }];
  const shown = { id: 'a', version: 5, data: { prompt: 'hi' }, x: 10, y: 20, display_name: null, deleted_at: null };
  const update = (row: Record<string, unknown>, table = 'nodes') =>
    ({ table, eventType: 'UPDATE', new: { ...shown, ...row } }) as const;

  it('ignores an update the tab already holds', () => {
    expect(isOwnEcho(update({}), tiles)).toBe(true);
  });

  it('ignores the echo of its own save, whatever version it carries', () => {
    expect(isOwnEcho(update({ version: 6 }), tiles)).toBe(true);
  });

  it('refetches a newer update from someone else', () => {
    expect(isOwnEcho(update({ version: 6, data: { prompt: 'agent wrote this' } }), tiles)).toBe(false);
  });

  it('refetches a move by an agent, which keeps the same version', () => {
    expect(isOwnEcho(update({ x: 400 }), tiles)).toBe(false);
  });

  it('refetches a soft delete and a rename by an agent', () => {
    expect(isOwnEcho(update({ deleted_at: '2026-09-30T00:00:00Z' }), tiles)).toBe(false);
    expect(isOwnEcho(update({ display_name: 'Hook' }), tiles)).toBe(false);
  });

  it('refetches inserts, deletes and connections', () => {
    expect(isOwnEcho({ table: 'nodes', eventType: 'INSERT', new: { id: 'z', version: 1 } }, tiles)).toBe(false);
    expect(isOwnEcho(update({}, 'nodes_connections'), tiles)).toBe(false);
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

describe('server-owned fields: a run result always reaches the screen', () => {
  const runStarted = { prompt: 'write a haiku', refId: null, running: true, error: null };
  const runFinished = { prompt: 'write a haiku', refId: 'asset-1', running: false, error: null, runId: 'run-1' };

  it('keepDirty adopts refId and running even when the tab marked them dirty', () => {
    const local: Tile[] = [{ id: 'a', version: 3, data: { ...runStarted, prompt: 'write a sonnet' } }];
    const fresh: Tile[] = [{ id: 'a', version: 5, data: runFinished }];

    const next = keepDirty(fresh, local, () => ['prompt', 'refId', 'running', 'error']);

    expect(next[0].data).toEqual({ ...runFinished, prompt: 'write a sonnet' });
  });

  it('adoptIdleRows adopts the result while the prompt being typed stays', () => {
    const local: Tile[] = [{ id: 'a', version: 3, data: { ...runStarted, prompt: 'write a sonnet' } }];

    const next = adoptIdleRows(local, [{ id: 'a', version: 5, data: runFinished }], () => ['prompt', 'refId', 'running']);

    expect(next[0].data).toEqual({ ...runFinished, prompt: 'write a sonnet' });
  });

  it('keepLocal never holds a server-owned field', () => {
    expect(keepLocal(runFinished, runStarted, ['refId', 'running', 'runId', 'outputUncensored'])).toEqual(runFinished);
  });

  it('a run finishing is never an echo, even while the tab is saving that node', () => {
    const tiles = [{ id: 'a', version: 5, data: runStarted, x: 0, y: 0, displayName: null }];
    const change = { table: 'nodes', eventType: 'UPDATE', new: { id: 'a', version: 6, data: runFinished, x: 0, y: 0, display_name: null, deleted_at: null } };

    expect(isOwnEcho(change, tiles)).toBe(false);
  });
});
