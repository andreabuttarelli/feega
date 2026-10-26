import { describe, expect, it, vi } from 'vitest';

const HOP_MS = 40;
const slow = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), HOP_MS));

const NODE = { format: 'landscape', lastRenderAssetId: null, posterAssetId: null };
const RECORD = { id: 'n1', displayName: 'Frame', data: {} };

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: () => slow([{ org: { id: 'o1', name: 'o', slug: 'o' }, role: 'member' }]) }));
vi.mock('$lib/server/canvas/lookup', () => ({
  openCanvasForUser: () => slow({ memberships: [{ org: { id: 'o1', name: 'o', slug: 'o' }, role: 'member' }], found: { orgId: 'o1', canvas: { id: 'c1', projectId: 'p1', name: 'Canvas' }, mode: 'standard', projectBrandId: null } })
}));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: () => slow(true) }));
vi.mock('./editor', () => ({
  findMotionNode: () => slow({ record: RECORD, node: NODE }),
  newHead: () => ({ version: 0, doc: { scenes: [] } }),
  headOrNew: () => slow({ version: 3, doc: { scenes: [] } }),
  motionTokens: () => slow({}),
  motionAssets: () => slow([])
}));
vi.mock('$lib/server/repos/motion-revisions', () => ({ headCache: () => new Map(), readHead: () => slow({ version: 3, doc: { scenes: [] } }) }));
vi.mock('$lib/server/repos/node-runs', () => ({ listNodeRuns: () => slow([]) }));
vi.mock('./templates', () => ({ templateLibrary: () => ({ own: () => slow([]) }) }));
vi.mock('$lib/server/gallery/editor', () => ({ editorGallery: () => slow(null) }));
vi.mock('./renderer', () => ({ motionRenderFarm: () => null, knownRenderLimit: () => null }));
vi.mock('./font-upload', () => ({ orgFontFamilies: () => slow([]) }));

const { loadEditorSession } = await import('./editor-session');
const { serverTiming } = await import('$lib/server/server-timing');

const locals = {
  safeGetSession: () => slow({ session: {}, user: { id: 'u1' } }),
  db: async () => ({})
} as unknown as App.Locals;

const params = { projectId: 'p1', canvasId: 'c1', nodeId: 'n1' };

describe('loadEditorSession', () => {
  it('apre la sessione in tre giri: tela e appartenenze insieme, poi nodo e dati insieme', async () => {
    const started = performance.now();
    const data = await loadEditorSession(locals, params);
    const elapsed = performance.now() - started;

    expect(data.head.version).toBe(3);
    expect(elapsed).toBeLessThan(HOP_MS * 4);
  });

  it('dice per fase dove è andato il tempo', async () => {
    const phases = serverTiming();
    await loadEditorSession(locals, params, phases);

    expect(phases.header()).toMatch(/scope;dur=\d+/);
    expect(phases.header()).toMatch(/head;dur=\d+/);
    expect(phases.header()).toMatch(/assets;dur=\d+/);
    expect(phases.header()).toMatch(/fonts;dur=\d+/);
  });
});
