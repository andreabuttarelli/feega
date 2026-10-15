import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { DocMode } from '$lib/motion/still';
import { appendRevision, listRevisions, readHead } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';
import type { EditorFrames } from '$lib/server/motion/tool-run';

const ORG = 'org-1';
const PROJECT = 'p-1';
const NODE = 'node-1';

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('$lib/server/repos/motion-templates', () => ({ listOrgTemplates: async () => [], insertOrgTemplate: vi.fn(), deleteOrgTemplate: vi.fn() }));
vi.mock('$lib/server/repos/assets', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/assets')>()), listProjectAssets: async () => [] }));
vi.mock('$lib/server/canvas/sign-media', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/canvas/sign-media')>()), signAssetPaths: async () => new Map(), createAssetSigningDb: () => ({}) }));
vi.mock('$lib/server/repos/projects', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/projects')>()), findProjectById: async () => ({ id: PROJECT, brandId: null, mode: 'standard' }) }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  patchNodeData: vi.fn(async () => ({ ok: true })),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) =>
    input.orgId === ORG && input.nodeId === NODE ? { id: NODE, canvasId: 'c-1', projectId: PROJECT, type: 'motion', displayName: 'Poster', data: { format: '4:5' }, version: 1 } : null
}));

const { createFrameTools, editorFrames, FRAME_TOOL, LIST_FRAME_TOOLS, DESCRIBE_FRAME_TOOL } = await import('./frame-tools');
const { putFrames, framesPrefix } = await import('$lib/server/motion/frame-store');

const OPEN = { nodeId: NODE, selection: [], playhead: 1.5, mode: DocMode.Video };
const TITLE = { component: 'Title', start: 0, duration: 2, props: { text: 'Said in the canvas chat' } };

type Deps = Parameters<typeof createFrameTools>[0];

const tools = (over: Partial<Deps> = {}) => createFrameTools({ db: state.db as never, orgId: ORG, projectId: PROJECT, userId: 'u-1', open: OPEN, editor: null, serverDraws: () => false, ...over });

const call = (t: Tool, input: unknown, toolCallId = 'call-1') => t.execute!(input as never, { toolCallId, messages: [], context: {} }) as Promise<Record<string, unknown>>;

const head = async () => (await readHead(state.db as never, { orgId: ORG, nodeId: NODE }))?.doc as MotionDoc;

beforeEach(async () => {
  const fake = revisionsDb();
  state.db = fake.db;
  await appendRevision(fake.db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Portrait), actor: { kind: 'user', id: 'u-1' }, summary: 'start' });
});

describe('the canvas chat edits a frame with the same tools as the frame editor', () => {
  it('a frame tool on the open frame writes a revision signed by the sidebar agent', async () => {
    const out = await call(tools()[FRAME_TOOL], { tool: 'add_clip', input: TITLE });

    expect(out).toMatchObject({ node_id: NODE, version: 2, saved: true, output: { ok: true } });
    expect(JSON.stringify((await head()).tracks)).toContain('Said in the canvas chat');
    const [latest] = await listRevisions(state.db as never, { orgId: ORG, nodeId: NODE });
    expect(latest).toMatchObject({ version: 2, actorKind: 'agent' });
  });

  it('node_id addresses a frame that is not open', async () => {
    const out = await call(tools({ open: null })[FRAME_TOOL], { node_id: NODE, tool: 'get_motion_doc', input: {} });

    expect(out).toMatchObject({ saved: false, output: { width: 1080 } });
  });

  it('with no frame open and no node_id it asks for one instead of guessing', async () => {
    expect(await call(tools({ open: null })[FRAME_TOOL], { tool: 'get_motion_doc', input: {} })).toMatchObject({ error: 'no_frame' });
  });

  it('a frame of another project is not found', async () => {
    const out = await call(tools({ projectId: 'p-other' })[FRAME_TOOL], { tool: 'get_motion_doc', input: {} });

    expect(out).toMatchObject({ error: 'motion_node_not_found' });
  });

  it('an unknown tool names where the list is', async () => {
    expect(await call(tools()[FRAME_TOOL], { tool: 'make_it_pop', input: {} })).toMatchObject({ error: 'unknown_tool', message: expect.stringContaining(LIST_FRAME_TOOLS) });
  });

  it('list and describe expose the whole editor toolset without loading it into the prompt', async () => {
    const t = tools();
    const listed = (await call(t[LIST_FRAME_TOOLS], {})) as { tools: { name: string }[] };
    const spec = (await call(t[DESCRIBE_FRAME_TOOL], { tool: 'set_canvas' })) as { input_schema: { properties: object } };

    expect(listed.tools.length).toBeGreaterThan(100);
    expect(spec.input_schema.properties).toHaveProperty('still');
  });

  it('frame_tool names every editor tool, so a turn does not spend a step listing them', async () => {
    const { motionToolList } = await import('$lib/server/motion/tool-run');
    const description = String(tools()[FRAME_TOOL].description);

    for (const { name } of motionToolList()) {
      expect(description).toContain(name);
    }
  });

  it('two calls in one turn share the session: describe_frames reads what view_frames saw', async () => {
    const editor: EditorFrames = async (_callId, times) => times.map((time) => ({ time, bytes: Buffer.from('jpeg') }));
    const t = tools({ editor });
    await call(t[FRAME_TOOL], { tool: 'add_clip', input: TITLE }, 'c-add');
    await call(t[FRAME_TOOL], { tool: 'view_frames', input: { times: [0.5] } }, 'c-view');
    const described = await call(t[FRAME_TOOL], { tool: 'describe_frames', input: { frames: [{ time: 0.5, visible: 'title centred, readable', wrong: 'nothing' }] } }, 'c-desc');

    expect(described).toMatchObject({ output: { ok: true } });
  });
});

describe('looking at a frame needs a player', () => {
  it('view_frames with no editor open and no server player is refused cleanly', async () => {
    const out = await call(tools({ open: null })[FRAME_TOOL], { node_id: NODE, tool: 'view_frames', input: { times: [0] } });

    expect(out).toMatchObject({ error: 'needs_open_editor' });
  });

  it('view_frames on the open frame asks the editor, and the model gets the pictures', async () => {
    const asked: { callId: string; times: number[] }[] = [];
    const editor: EditorFrames = async (callId, times) => {
      asked.push({ callId, times });
      return times.map((time) => ({ time, bytes: Buffer.from('jpeg') }));
    };
    const t = tools({ editor })[FRAME_TOOL];
    await call(t, { tool: 'add_clip', input: TITLE }, 'c-add');
    const output = await call(t, { tool: 'view_frames', input: { times: [0.5] } }, 'c-view');
    const forModel = (await t.toModelOutput!({ toolCallId: 'c-view', input: {}, output } as never)) as { type: string; value: { type: string }[] };

    expect(asked).toEqual([{ callId: 'c-view', times: [0.5] }]);
    expect(forModel.type).toBe('content');
    expect(forModel.value.some((p) => p.type === 'file')).toBe(true);
  });
});

describe('the open editor draws the frames the canvas chat asks for', () => {
  function memoryBucket() {
    const files = new Map<string, Buffer>();
    return {
      upload: async (path: string, bytes: Buffer) => {
        files.set(path, bytes);
        return { error: null };
      },
      list: async (prefix: string) => ({ data: [...files.keys()].filter((k) => k.startsWith(`${prefix}/`)).map((k) => ({ name: k.slice(prefix.length + 1) })), error: null }),
      download: async (path: string) => ({ data: new Blob([new Uint8Array(files.get(path)!)]), error: null }),
      remove: async () => ({ error: null })
    };
  }

  it('the request goes down the chat stream and the upload comes back as frames', async () => {
    const bucket = memoryBucket();
    const place = { orgId: ORG, projectId: PROJECT, nodeId: NODE, userId: 'u-1' };
    const asked: string[] = [];
    const draw = editorFrames(state.db as never, bucket, place, (request) => {
      asked.push(request.callId);
      void putFrames(bucket, framesPrefix(place, request.callId), request.times.map((time) => ({ time, bytes: Buffer.from('jpeg') })));
    });

    const frames = await draw('c-9', [0, 1], newMotionDoc(MotionFormat.Portrait));

    expect(asked).toEqual(['c-9']);
    expect(frames?.map((f) => f.time)).toEqual([0, 1]);
  });
});
