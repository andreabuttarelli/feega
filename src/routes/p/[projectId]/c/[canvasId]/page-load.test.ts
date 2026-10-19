import { beforeEach, describe, expect, it, vi } from 'vitest';

const own = vi.fn();
const cardPreviews = vi.fn();
const listNodes = vi.fn();
const list = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: async () => ({ orgId: 'org-1', canvas: { id: 'canvas-1', projectId: 'project-1' }, mode: 'standard', projectBrandId: null }) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({ ...(await importOriginal<object>()), listNodes: (...a: unknown[]) => listNodes(...a), listConnections: async () => [] }));
vi.mock('$lib/server/project-catalogue', () => ({ projectCatalogue: async () => [] }));
vi.mock('$lib/server/canvas/canvas-share', () => ({ ShareState: { On: 'on', Off: 'off' }, readCanvasShare: async () => null, setCanvasShare: vi.fn() }));
vi.mock('$lib/server/canvas/reference-library', () => ({ referenceLibrary: async () => [] }));
vi.mock('$lib/server/motion/move-element', async (importOriginal) => ({ ...(await importOriginal<object>()), canvasFrameInputs: async (_db: unknown, _s: unknown, _n: unknown, listed: unknown) => listed }));
vi.mock('$lib/server/canvas/snapshot', () => ({ canvasSnapshot: vi.fn(), loadGenRuns: async () => [], loadDownloaded: async () => ({ products: [], socialPosts: [], influencers: [] }) }));
vi.mock('$lib/server/repos/posts', () => ({ listSourcesForNodes: async () => [] }));
vi.mock('$lib/server/onboarding/first-run', () => ({ firstRunFor: async () => null, endOnboarding: vi.fn(), runDemo: vi.fn() }));
vi.mock('$lib/server/motion/templates', () => ({ templateLibrary: () => ({ own, list }) }));
vi.mock('$lib/server/canvas/chat-handoff', () => ({ chatHandoff: async () => null }));
vi.mock('$lib/server/motion/frame-outlines', () => ({ canvasOutlines: async () => ({}) }));
vi.mock('$lib/server/canvas-renderer-switch', () => ({ rendererSwitch: async () => null }));
vi.mock('$lib/server/canvas/card-previews', () => ({ cardPreviews: (...a: unknown[]) => cardPreviews(...a) }));

import { load } from '$lib/server/canvas/canvas-page';

const event = {
  params: { projectId: 'project-1', canvasId: 'canvas-1' },
  url: new URL('http://localhost/p/project-1/c/canvas-1'),
  locals: { safeGetSession: async () => ({ session: {}, user: { id: 'user-1', created_at: '2026-01-01' } }), db: async () => ({}) }
} as never;

const ORG_TEMPLATE = { id: 'org-template', template: { name: 'Mine' } };

beforeEach(() => {
  vi.clearAllMocks();
  listNodes.mockResolvedValue([]);
  cardPreviews.mockResolvedValue({});
  own.mockResolvedValue([ORG_TEMPLATE]);
  list.mockResolvedValue([{ id: 'builtin:x', template: { name: 'Builtin' } }, ORG_TEMPLATE]);
});

describe('canvas page load', () => {
  it('ships only the org templates: the built-in ones are already in the page bundle', async () => {
    const data = (await load(event)) as Record<string, unknown>;

    expect(data.orgTemplates).toEqual([ORG_TEMPLATE]);
    expect(data).not.toHaveProperty('componentTemplates');
  });

  it('asks for the card previews without waiting for the nodes', async () => {
    listNodes.mockReturnValue(new Promise(() => {}));

    void load(event);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(cardPreviews).toHaveBeenCalled();
  });
});
