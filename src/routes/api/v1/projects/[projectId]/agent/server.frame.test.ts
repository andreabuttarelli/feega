import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { CostTier, type ChatModelOption } from '$lib/chat-model';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { appendRevision, listRevisions, readHead } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';

const ORG = 'org-1';
const PROJECT = 'p-1';
const NODE = 'node-1';
const SAID = 'Typed in the frame chat';

const calls = vi.hoisted(() => ({ systems: [] as string[], threads: [] as unknown[], logged: 0, db: null as unknown }));

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };

function scriptedModel() {
  let step = 0;
  return new MockLanguageModelV4({
    doStream: async (options) => {
      calls.systems.push(JSON.stringify(options.prompt[0]));
      const first = step++ === 0;
      const chunks = first
        ? [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'frame_tool', input: JSON.stringify({ tool: 'add_clip', input: { component: 'Title', start: 0, duration: 2, props: { text: SAID } } }) }, { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage }]
        : [{ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'Done.' }, { type: 'text-end', id: 't' }, { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage }];
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            chunks.forEach((c) => controller.enqueue(c as never));
            controller.close();
          }
        })
      };
    }
  });
}

const OFFERED: ChatModelOption[] = [{ id: 'anthropic/claude-opus-5.5', label: 'X', provider: 'anthropic', costTier: CostTier.Low, inputUsdPerM: 1, outputUsdPerM: 1, efforts: [], defaultEffort: null }];

vi.mock('$lib/server/chat-model/catalogue', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/chat-model/catalogue')>()), offeredChatModels: async () => OFFERED }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/llm', () => ({ llmLanguageModel: () => scriptedModel() }));
vi.mock('$lib/server/ai-log', () => ({
  extractSdkUsage: () => ({}),
  logAiCall: () => {
    calls.logged++;
  },
  withBrandContext: (_id: string, fn: () => void) => fn(),
  withOrgContext: (_id: string, fn: () => void) => fn()
}));
vi.mock('$lib/server/cli-auth', () => ({ gateAiAction: async () => null, gateOrgAiAction: async () => null }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/projects/lookup', () => ({ findReachableProject: async () => ({ orgId: ORG, project: { id: PROJECT, name: 'P', brandId: null } }) }));
vi.mock('$lib/server/repos/chat', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/chat')>()),
  openThread: async (_db: unknown, input: unknown) => {
    calls.threads.push(input);
    return 'thread-1';
  },
  loadTurns: async () => [],
  saveTurn: async () => undefined
}));
vi.mock('$lib/server/repos/chat-reply', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/chat-reply')>()),
  openReply: async () => ({ progress: async () => undefined, finish: async () => undefined })
}));
vi.mock('$lib/server/project-agent/project-tools', () => ({ createProjectTools: () => ({}) }));
vi.mock('$lib/server/project-agent/tool-surface', () => ({ openAgentTools: async (input: { projectTools: object }) => ({ tools: input.projectTools, close: async () => undefined }) }));
vi.mock('$lib/server/repos/motion-templates', () => ({ listOrgTemplates: async () => [], insertOrgTemplate: vi.fn(), deleteOrgTemplate: vi.fn() }));
vi.mock('$lib/server/repos/assets', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/assets')>()), listFontAssets: async () => [], listProjectAssets: async () => [] }));
vi.mock('$lib/server/canvas/sign-media', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/canvas/sign-media')>()), signAssetPaths: async () => new Map(), createAssetSigningDb: () => ({}) }));
vi.mock('$lib/server/repos/projects', async (importOriginal) => ({ ...(await importOriginal<typeof import('$lib/server/repos/projects')>()), findProjectById: async () => ({ id: PROJECT, brandId: null, mode: 'standard' }) }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  listCanvases: async () => [],
  patchNodeData: vi.fn(async () => ({ ok: true })),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) => (input.nodeId === NODE ? { id: NODE, canvasId: 'c-1', projectId: PROJECT, type: 'motion', displayName: 'Poster', data: { format: '4:5' }, version: 1 } : null)
}));

const { POST } = await import('./+server');

function post(body: Record<string, unknown>) {
  const request = new Request(`http://x/api/v1/projects/${PROJECT}/agent`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'make the title say it', ...body }) });
  const locals = { safeGetSession: async () => ({ session: { access_token: 'tok' }, user: { id: 'u-1' } }), db: async () => calls.db };
  return POST({ request, url: new URL(request.url), params: { projectId: PROJECT }, locals } as never);
}

async function settled(res: Response) {
  await res.text();
  for (let i = 0; i < 100 && !calls.logged; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
}

const head = async () => (await readHead(calls.db as never, { orgId: ORG, nodeId: NODE }))?.doc as MotionDoc;

beforeEach(async () => {
  const fake = revisionsDb();
  calls.db = Object.assign(fake.db, { storage: { from: () => ({}) } });
  calls.systems.length = 0;
  calls.threads.length = 0;
  calls.logged = 0;
  await appendRevision(fake.db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Portrait), actor: { kind: 'user', id: 'u-1' }, summary: 'start' });
});

describe('one chat: the canvas chat edits the frame open in the editor', () => {
  it('a frame tool called by the canvas chat writes a revision on the open frame', async () => {
    await settled(await post({ frame: { nodeId: NODE, selection: ['clip-a'], playhead: 1.25, mode: 'video' } }));

    expect(JSON.stringify((await head()).tracks)).toContain(SAID);
    const [latest] = await listRevisions(calls.db as never, { orgId: ORG, nodeId: NODE });
    expect(latest).toMatchObject({ version: 2, actorKind: 'agent' });
  });

  it('the open frame, its selection and playhead reach the system prompt', async () => {
    await settled(await post({ frame: { nodeId: NODE, selection: ['clip-a'], playhead: 1.25, mode: 'video' } }));

    expect(calls.systems[0]).toContain(`frame ${NODE} open in the editor`);
    expect(calls.systems[0]).toContain('clip-a');
    expect(calls.systems[0]).toContain('1.25s');
  });

  it('the frame chat lands in the canvas thread, the same the sidebar reads', async () => {
    await settled(await post({ frame: { nodeId: NODE } }));

    expect(calls.threads).toEqual([expect.objectContaining({ orgId: ORG, projectId: PROJECT, userId: 'u-1' })]);
  });

  it('with no frame open the prompt says so and nothing is written', async () => {
    await settled(await post({}));

    expect(calls.systems[0]).toContain('No frame is open');
    expect((await head()).tracks.flatMap((t) => t.clips)).toEqual([]);
  });
});
