import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountOfBody, fileAccountStore, memoryAccountStore } from './account';

const jwt = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
const body = { access_token: jwt({ sub: 'u1', email: 'a@b.co' }), refresh_token: 'r', expires_at: 99 };

describe('accountOfBody', () => {
  it('legge utente ed email dal token', () => {
    expect(accountOfBody(body)).toEqual({ access_token: body.access_token, refresh_token: 'r', expires_at: 99, user: { id: 'u1', email: 'a@b.co' } });
  });

  it('rifiuta un corpo senza token', () => {
    expect(accountOfBody({ refresh_token: 'r' })).toBeNull();
    expect(accountOfBody({ ...body, access_token: 'not-a-jwt' })).toBeNull();
  });
});

describe('fileAccountStore', () => {
  const file = () => join(mkdtempSync(join(tmpdir(), 'feega-acc-')), 'cfg', 'session.json');
  const account = accountOfBody(body)!;

  it('scrive il formato del CLI e lo rilegge', async () => {
    const path = file();
    const store = fileAccountStore(path);
    expect(await store.read()).toBeNull();
    await store.write(account);
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(account);
    expect(await store.read()).toEqual(account);
  });

  it('clear cancella la sessione', async () => {
    const store = fileAccountStore(file());
    await store.write(account);
    await store.clear();
    expect(await store.read()).toBeNull();
  });

  it('un file illeggibile vale come nessuna sessione', async () => {
    const path = file();
    const store = fileAccountStore(path);
    await store.write(account);
    writeFileSync(path, '{nope');
    expect(await store.read()).toBeNull();
  });
});

describe('memoryAccountStore', () => {
  it('conserva e cancella', async () => {
    const store = memoryAccountStore();
    await store.write(accountOfBody(body)!);
    expect((await store.read())?.user.email).toBe('a@b.co');
    await store.clear();
    expect(await store.read()).toBeNull();
  });
});
