import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { FEEGA_VERSION, FeegaRefusal, packFeega, type FeegaFile } from '$lib/canvas/feega-file';
import { FeegaImport, importCanvasFile, importStoredCanvasFile } from './feega-file';

const OLD_PROJECT = '11111111-1111-4111-8111-111111111111';
const OLD_CANVAS = '22222222-2222-4222-8222-222222222222';
const TEXT = '33333333-3333-4333-8333-333333333333';
const IMAGE = '44444444-4444-4444-8444-444444444444';
const EDGE = '55555555-5555-4555-8555-555555555555';
const ASSET = '66666666-6666-4666-8666-666666666666';

const user = { kind: 'user' as const, id: 'u' };
const target = { orgId: 'org', projectId: 'p2', actor: user };

const file: FeegaFile = {
  manifest: { format: 'feega', version: FEEGA_VERSION, exportedAt: '2026-10-25T00:00:00.000Z', canvasName: 'Launch', source: { projectId: OLD_PROJECT, canvasId: OLD_CANVAS } },
  canvas: {
    nodes: [
      { id: TEXT, type: 'text', displayName: 'Brief', position: { x: 10, y: 20, z: 3 }, size: { width: 300, height: 200 }, data: { prompt: 'hello' } },
      { id: IMAGE, type: 'image', displayName: null, position: { x: 400, y: 20, z: 4 }, size: { width: null, height: null }, data: { assetId: ASSET, url: `/p/${OLD_PROJECT}/c/${OLD_CANVAS}/assets/${ASSET}` } }
    ],
    connections: [{ id: EDGE, sourceNodeId: TEXT, targetNodeId: IMAGE, sourceHandle: null, targetHandle: 'prompt', mode: 'fixed' }],
    heads: {},
    assets: [{ id: ASSET, type: 'image', mimeType: 'image/png', width: 2, height: 2, durationS: null, content: null, url: null, file: 'assets/0-logo.png' }]
  }
};

const packed = packFeega(file, new Map([['assets/0-logo.png', new Uint8Array([1, 2, 3])]]));

const world = () => fakeDb({ canvases: [], nodes: [], nodes_connections: [], assets: [], canvas_events: [], motion_revisions: [] }, { store: true, filter: true });

describe('importing a .feega file', () => {
  it('lands as a new canvas whose nodes, lines and files point at each other under new ids', async () => {
    const fake = world();

    const out = await importCanvasFile(fake.db, { ...target, bytes: packed });

    expect(out.outcome).toBe(FeegaImport.Imported);
    const canvasId = out.outcome === FeegaImport.Imported ? out.canvas.id : '';
    const nodes = fake.calls.filter((c) => c.table === 'nodes' && c.op === 'insert').map((c) => c.payload as { id: string; z?: number; canvas_id: string; project_id: string; display_name: string | null; data: { assetId?: string; url?: string } });
    const [text, image] = nodes;
    expect(nodes.map((n) => n.id)).not.toContain(TEXT);
    expect(text).toMatchObject({ canvas_id: canvasId, project_id: 'p2', display_name: 'Brief', z: 3 });

    const asset = fake.calls.find((c) => c.table === 'assets' && c.op === 'insert')?.payload as { project_id: string; source: string; url: string };
    expect(asset).toMatchObject({ project_id: 'p2', source: 'upload' });
    expect(asset.url.startsWith('org/p2/')).toBe(true);
    expect(fake.calls.some((c) => c.table === 'storage:canvas-assets' && c.op === 'upload' && c.filters[0][1] === asset.url)).toBe(true);
    expect(image.data.assetId).not.toBe(ASSET);
    expect(image.data.url).toBe(`/p/p2/c/${canvasId}/assets/${image.data.assetId}`);

    const edge = fake.calls.find((c) => c.table === 'nodes_connections' && c.op === 'insert')?.payload as Record<string, unknown>;
    expect(edge).toMatchObject({ source_node_id: text.id, target_node_id: image.id, target_handle: 'prompt' });
  });

  it('can be imported twice without the second copy colliding with the first', async () => {
    const fake = world();
    await importCanvasFile(fake.db, { ...target, bytes: packed });
    await importCanvasFile(fake.db, { ...target, bytes: packed });

    const ids = fake.calls.filter((c) => c.table === 'nodes' && c.op === 'insert').map((c) => (c.payload as { id: string }).id);
    expect(new Set(ids).size).toBe(4);
  });

  it('refuses a damaged file before creating anything', async () => {
    const fake = world();
    expect(await importCanvasFile(fake.db, { ...target, bytes: new Uint8Array([1, 2, 3]) })).toEqual({ outcome: FeegaImport.Refused, refusal: FeegaRefusal.NotFeega });
    expect(fake.calls.some((c) => c.op === 'insert')).toBe(false);
  });

  it('reads only a file uploaded into the target project, and removes it after', async () => {
    const fake = fakeDb({ canvases: [], nodes: [], nodes_connections: [], assets: [], canvas_events: [] }, { store: true, filter: true, files: { 'other-org/p9/x.feega': packed, 'org/p2/imports/x.feega': packed } });

    expect(await importStoredCanvasFile(fake.db, { ...target, path: 'other-org/p9/x.feega' })).toEqual({ outcome: FeegaImport.Refused, refusal: FeegaRefusal.NotFeega });
    expect(fake.calls.some((c) => c.op === 'download')).toBe(false);

    expect((await importStoredCanvasFile(fake.db, { ...target, path: 'org/p2/imports/x.feega' })).outcome).toBe(FeegaImport.Imported);
    expect(fake.calls.some((c) => c.op === 'remove' && JSON.stringify(c.filters).includes('org/p2/imports/x.feega'))).toBe(true);
  });
});
