import { afterEach, describe, expect, it } from 'vitest';
import type { ChangeRow } from '../../messages';
import { startBridge, type Bridge } from './server';

const row: ChangeRow = { id: 1, at: 'src/Card.svelte:4:2', prop: 'padding', value: '16px', scope: 'element', files: ['src/Card.svelte'], time: 5 };

let open: Bridge | null = null;

afterEach(async () => {
  await open?.close();
  open = null;
});

async function get(path: string, token?: string) {
  open ??= await startBridge({ selection: () => 'Feega selection\nsource: src/Card.svelte:4:2', changes: () => [row] });
  return fetch(`http://127.0.0.1:${open.port}${path}`, { headers: token === undefined ? {} : { authorization: `Bearer ${token}` } });
}

describe('bridge', () => {
  it('serves the selection to the holder of the token', async () => {
    await get('/selection');
    const reply = await get('/selection', open!.token);

    expect(await reply.json()).toEqual({ context: 'Feega selection\nsource: src/Card.svelte:4:2' });
  });

  it('serves the changes', async () => {
    await get('/changes');
    const reply = await get('/changes', open!.token);

    expect(await reply.json()).toEqual({ changes: [row] });
  });

  it('refuses a request without the token', async () => {
    expect((await get('/selection')).status).toBe(401);
    expect((await get('/selection', 'wrong')).status).toBe(401);
  });

  it('answers 404 for another path', async () => {
    await get('/changes');

    expect((await get('/other', open!.token)).status).toBe(404);
  });

  it('listens on the loopback only', async () => {
    await get('/changes');

    expect(open!.host).toBe('127.0.0.1');
  });
});
