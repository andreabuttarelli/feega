import { readFileSync } from 'node:fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';

const resolveOrgCaller = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({
  resolveOrgCaller: (...args: unknown[]) => resolveOrgCaller(...args)
}));

vi.mock('$lib/server/canvas/sign-media', () => ({
  createAssetSigningDb: () => ({}),
  signAssetPaths: async (_db: unknown, _service: unknown, paths: { uploaded: string[] }) => new Map(paths.uploaded.map((p) => [p, `https://signed/${p}`]))
}));

import { DELETE, GET, POST } from './+server';

type Handler = (event: unknown) => Promise<Response>;

const ORG = '11111111-1111-1111-1111-111111111111';
const FRAUNCES = new Uint8Array(readFileSync('static/fonts/fraunces-latin.woff2'));

function caller(db: FakeDb, writeAllowed = true) {
  resolveOrgCaller.mockResolvedValue({ caller: { orgId: ORG, userId: 'user-1', db: db.db, writeAllowed } });
}

async function call(handler: unknown, method: string, init: { body?: BodyInit; query?: string } = {}) {
  const url = new URL(`https://feega.test/api/v1/org/fonts${init.query ?? ''}`);
  const request = new Request(url, { method, headers: { authorization: 'Bearer t' }, body: init.body });
  const res = await (handler as Handler)({ request, url });
  return { res, body: await res.json() };
}

const upload = (bytes: Uint8Array, name: string) => JSON.stringify({ name, base64: Buffer.from(bytes).toString('base64') });

const storeOf = () => fakeDb({ assets: [], org_fonts: [] }, { filter: true, store: true, mutate: true, files: {} });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/api/v1/org/fonts', () => {
  it('uploads a real font into the org library and lists it with a signed url', async () => {
    const fake = storeOf();
    caller(fake);

    const posted = await call(POST, 'POST', { body: upload(FRAUNCES, 'Fraunces.woff2') });
    expect(posted.res.status).toBe(201);
    expect(posted.body.font).toMatchObject({ family: 'Fraunces' });

    const listed = await call(GET, 'GET');
    expect(listed.body.fonts).toEqual([expect.objectContaining({ family: 'Fraunces', url: expect.stringMatching(new RegExp(`^https://signed/${ORG}/fonts/`)) })]);
  });

  it('refuses a file that is not a font, whatever its name', async () => {
    caller(storeOf());

    const { res, body } = await call(POST, 'POST', { body: upload(new TextEncoder().encode('<svg/>'), 'evil.woff2') });

    expect(res.status).toBe(400);
    expect(body.error).toContain('not a font');
  });

  it('refuses writes from a read-only key', async () => {
    caller(storeOf(), false);

    expect((await call(POST, 'POST', { body: upload(FRAUNCES, 'f.woff2') })).res.status).toBe(403);
    expect((await call(DELETE, 'DELETE', { query: '?family=Fraunces' })).res.status).toBe(403);
  });

  it('deletes a whole family', async () => {
    const fake = storeOf();
    caller(fake);
    await call(POST, 'POST', { body: upload(FRAUNCES, 'Fraunces.woff2') });

    const { res } = await call(DELETE, 'DELETE', { query: '?family=Fraunces' });

    expect(res.status).toBe(200);
    expect(fake.calls.filter((c) => c.op === 'delete').map((c) => c.table)).toEqual(['org_fonts', 'assets']);
    expect(fake.calls.find((c) => c.op === 'remove')?.filters[0][1]).toEqual([expect.stringMatching(new RegExp(`^${ORG}/fonts/`))]);
  });
});
