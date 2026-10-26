import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, type Call } from '$lib/server/db/fake-db';
import type { Db } from '$lib/server/db/client';
import { orgFontPrefix } from '$lib/motion/fonts/upload-path';

const ORG = '11111111-1111-1111-1111-111111111111';
const PROJECT = '22222222-2222-2222-2222-222222222222';
const CANVAS = '33333333-3333-3333-3333-333333333333';
const NODE = '44444444-4444-4444-4444-444444444444';
const USER = '55555555-5555-5555-5555-555555555555';
const PATH = `${orgFontPrefix(ORG)}upload-fraunces.woff2`;
const FRAUNCES = new Uint8Array(readFileSync('static/fonts/fraunces-latin.woff2'));

const resolveOrgCaller = vi.fn();

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: (...a: unknown[]) => resolveOrgCaller(...a) }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [{ org: { id: ORG }, role: 'owner' }] }));
const lookupFound = () => ({ orgId: ORG, canvas: { id: CANVAS, projectId: PROJECT, name: 'C', viewport: null }, mode: 'standard', projectBrandId: null });
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: async () => lookupFound(), openCanvasForUser: async () => ({ memberships: [{ org: { id: ORG }, role: 'owner' }], found: lookupFound() }) }));
vi.mock('$lib/server/canvas/sign-media', async (real) => ({ ...(await real<object>()), createAssetSigningDb: () => ({}), signAssetPaths: async (_db: unknown, _s: unknown, paths: { uploaded: string[] }) => new Map(paths.uploaded.map((p) => [p, `signed:${p}`])) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));

const { actions } = await import('$lib/server/frame-editor/editor-page');
const { POST } = await import('../../../../../../api/v1/motion/[nodeId]/ops/+server');

const nodeRow = { id: NODE, org_id: ORG, project_id: PROJECT, canvas_id: CANVAS, type: 'motion', display_name: 'V', x: 0, y: 0, z: 0, width: null, height: null, data: {}, version: 1, deleted_at: null };

let db: Db;
let calls: Call[];

beforeEach(() => {
  vi.clearAllMocks();
  ({ db, calls } = fakeDb({ nodes: [nodeRow], motion_revisions: [], node_runs: [], assets: [] }, { filter: true, mutate: true, store: true, newId: () => 'font-asset', files: { [PATH]: FRAUNCES } }));
});

async function act(name: keyof typeof actions, form: Record<string, string>) {
  const fd = new FormData();
  Object.entries(form).forEach(([k, v]) => fd.append(k, v));
  const out = (await (actions[name] as (event: unknown) => Promise<unknown>)({
    request: { formData: async () => fd },
    params: { projectId: PROJECT, canvasId: CANVAS, nodeId: NODE },
    locals: { safeGetSession: async () => ({ session: {}, user: { id: USER } }), db: async () => db }
  })) as { status?: number; data?: unknown };
  return typeof out?.status === 'number' && out.status >= 400 ? { status: out.status, data: out.data as Record<string, unknown> } : { status: 200, data: JSON.parse(JSON.stringify(out)) };
}

async function op(name: string, input: Record<string, unknown>) {
  resolveOrgCaller.mockResolvedValue({ caller: { db, orgId: ORG, userId: USER, writeAllowed: true, apiKeyId: 'key-1' } });
  const url = new URL(`https://feega.test/api/v1/motion/${NODE}/ops`);
  const res = await (POST as (event: unknown) => Promise<Response>)({ request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify({ op: name, input }) }), params: { nodeId: NODE }, url });
  return { status: res.status, data: await res.json() };
}

describe('the org font library, from the editor and from /api/v1', () => {
  it('an uploaded file lands in the org library under its real family, with a signed url the video can load', async () => {
    const uploaded = await act('uploadFont', { path: PATH });

    expect(uploaded.status).toBe(200);
    expect(uploaded.data.font).toMatchObject({ assetId: 'font-asset', family: 'Fraunces' });
    expect(uploaded.data.asset).toMatchObject({ id: 'font-asset', kind: 'font', url: `signed:${PATH}` });
    expect(calls.find((c) => c.op === 'insert' && c.table === 'assets')?.payload).toMatchObject({ project_id: null, url: PATH });

    const listed = await op('list_fonts', {});
    expect(listed).toEqual({ status: 200, data: { fonts: [{ family: 'Fraunces', variants: [expect.objectContaining({ assetId: 'font-asset' })] }] } });
  });

  it('renames and deletes a family; a bad name or an unknown family is refused', async () => {
    await act('uploadFont', { path: PATH });

    expect(await act('renameFont', { family: 'Fraunces', to: 'House Serif' })).toMatchObject({ status: 200 });
    expect((await act('fonts', {})).data.fonts.map((f: { family: string }) => f.family)).toEqual(['House Serif']);
    expect(await act('renameFont', { family: 'House Serif', to: '<b>' })).toMatchObject({ status: 400 });
    expect(await op('delete_font', { family: 'Nope' })).toMatchObject({ status: 400 });
    expect(await act('deleteFont', { family: 'House Serif' })).toMatchObject({ status: 200 });
    expect(calls.some((c) => c.op === 'remove' && JSON.stringify(c.filters).includes(PATH))).toBe(true);
  });

  it('a file that is not a font never reaches the library', async () => {
    ({ db, calls } = fakeDb({ nodes: [nodeRow], assets: [] }, { filter: true, store: true, files: { [PATH]: new TextEncoder().encode('<svg/>') } }));

    expect(await act('uploadFont', { path: PATH })).toMatchObject({ status: 400, data: { error: expect.stringContaining('not a font') } });
    expect(calls.some((c) => c.op === 'insert')).toBe(false);
  });
});
