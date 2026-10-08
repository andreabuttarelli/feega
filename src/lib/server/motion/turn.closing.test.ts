import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { DEFAULT_SECONDS, MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { MotionStyle } from '$lib/motion/style-model';

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } };

type Part = { type: string; text?: string; toolName?: string };
type Message = { role: string; content: string | Part[] };
type Call = { prompt: Message[]; toolChoice?: { type: string; toolName?: string } };

const world = vi.hoisted(() => ({
  calls: [] as Call[],
  toolCalls: [] as string[],
  saved: [] as { role: string; content?: string }[],
  nudgesToIgnore: 0,
  rate: 1,
  models: [] as string[],
  visionFails: false,
  seesImages: false,
  viewsWhileEditing: false,
  blankViews: 0,
  views: 0,
  scripting: false,
  awaited: 0
}));

const SITE = 'https://supasito.com/';
const PROMISE = 'Every site you run. Up to date. In one place.';
const source = { url: SITE, quote: PROMISE };
const SCRIPT = {
  research: { audience: 'People who run several websites', problem: 'Changes scatter across chats', struggle: 'A client sends a new price for three sites', flow: ['Pick the site', 'Say what should change'], benefits: [{ claim: 'One place', source }], numbers: [], tone: 'calm', promise: { text: PROMISE, source } },
  acts: [
    { act: 'problem', start: 0, end: 3, scene: 'Scattered folders', on_screen: ['The price changed.'], ui: 'Finder: marta-bakery, cardstack-launch, supasito.com, each edited 9 days ago' },
    { act: 'solution', start: 3, end: 7, scene: 'One prompt', on_screen: ['Say what should change.'], ui: 'Sidebar Supasito, Cardstack, Marta Bakery; prompt Set the price to 12; preview' },
    { act: 'proof', start: 7, end: 11, scene: 'Preview', on_screen: ['In one place.'], sources: [source] },
    { act: 'claim', start: 11, end: 14, scene: 'Logo', on_screen: [PROMISE] }
  ]
};

const SUMMARY = 'Made a bold title card that pops in.';
const NOTE = 'Adding the title now.';

function lastMessage(prompt: Message[]): Message {
  return prompt[prompt.length - 1];
}

function textOf(message: Message): string {
  return typeof message.content === 'string' ? message.content : message.content.map((p) => p.text ?? '').join('');
}

function hasImage(message: Message): boolean {
  return Array.isArray(message.content) && message.content.some((p) => p.type === 'file');
}

function reply(call: Call): unknown[] {
  const last = lastMessage(call.prompt);
  const nudged = last.role === 'user' && /view_frames/.test(textOf(last));
  const text = (t: string) => [
    { type: 'text-start', id: 't' },
    { type: 'text-delta', id: 't', delta: t },
    { type: 'text-end', id: 't' },
    { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage }
  ];
  const tool = (name: string, input: unknown) => [
    { type: 'tool-call', toolCallId: `c${world.toolCalls.length}`, toolName: name, input: JSON.stringify(input) },
    { type: 'finish', finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage }
  ];

  if (call.toolChoice?.type === 'none') {
    return text(SUMMARY);
  }
  if (hasImage(last)) {
    return text('Frames look clean.');
  }
  if (nudged && world.nudgesToIgnore > 0) {
    world.nudgesToIgnore--;
    return text('Looks fine to me.');
  }
  if (nudged) {
    return tool('view_frames', { times: [1] });
  }
  if (world.viewsWhileEditing && last.role === 'tool' && JSON.stringify(last.content).includes('add_clip')) {
    return tool('view_frames', { times: [1] });
  }
  const answered = JSON.stringify(last.content);
  if (world.scripting && last.role === 'user') {
    return tool('analyze_site', { url: SITE });
  }
  if (world.scripting && last.role === 'tool' && answered.includes('analyze_site')) {
    return tool('write_script', SCRIPT);
  }
  if (last.role === 'user' || (world.scripting && last.role === 'tool' && answered.includes('write_script'))) {
    return tool('add_clip', { component: 'Title', start: 0, duration: DEFAULT_SECONDS, props: { text: 'Pop' } });
  }
  return text(NOTE);
}

function scripted() {
  return new MockLanguageModelV4({
    doStream: async (options) => {
      const call = { prompt: options.prompt as unknown as Message[], toolChoice: options.toolChoice as Call['toolChoice'] };
      world.calls.push(call);
      const parts = [{ type: 'stream-start', warnings: [] }, ...reply(call)];
      parts.filter((p) => (p as Part).type === 'tool-call').forEach((p) => world.toolCalls.push((p as Part).toolName!));
      return {
        stream: new ReadableStream({
          start(controller) {
            parts.forEach((p) => controller.enqueue(p as never));
            controller.close();
          }
        })
      };
    }
  });
}

function failing() {
  return new MockLanguageModelV4({
    doStream: async () => {
      throw new Error('tools[0].function_declarations[17]: missing field');
    }
  });
}

vi.mock('$lib/server/llm', () => ({
  llmLanguageModel: (id: string) => {
    world.models.push(id);
    return id === 'vision/model' && world.visionFails ? failing() : scripted();
  },
  llmCodeModel: () => 'code/model',
  llmVisionModel: () => 'vision/model'
}));
vi.mock('$lib/server/openrouter-models', () => ({
  ensureGatewayModels: async () => undefined,
  gatewayRate: () => ({ input: world.rate, cachedInput: world.rate, output: world.rate }),
  gatewayModel: () => (world.seesImages ? { usable: true } : null)
}));
vi.mock('$lib/server/ai-log', () => ({ extractSdkUsage: () => ({ inputTokens: 10, outputTokens: 5 }), logAiCall: vi.fn(), withOrgContext: (_id: string, fn: () => unknown) => fn() }));
vi.mock('$lib/server/moderation/model-input', () => ({ screenModelInput: async () => ({ ok: true }) }));
vi.mock('$lib/server/repos/chat', () => ({
  openNodeThread: async () => 'thread-1',
  loadTurns: async () => [],
  promptHistory: () => [],
  saveTurn: async (_db: unknown, turn: { role: string; content?: string }) => {
    world.saved.push(turn);
  }
}));
vi.mock('$lib/server/motion/editor', () => ({
  headOrNew: async () => ({ version: 0, doc: { ...newMotionDoc(MotionFormat.Landscape), style: MotionStyle.AppleMinimal }, summary: null, actorKind: 'system' }),
  motionTokens: async () => ({ name: 'Brand' }),
  motionAssets: async () => [],
  assetUrls: () => ({}),
  saveMotionDoc: async () => null
}));
vi.mock('$lib/server/motion/frame-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/motion/frame-store')>()),
  awaitFrames: async (_bucket: unknown, _prefix: string, count: number) => (world.awaited++, Array.from({ length: count }, (_, i) => ({ time: i, bytes: Buffer.from([0xff, 0xd8]) })))
}));
vi.mock('$lib/server/motion/frame-stats', () => ({
  frameStats: async (frames: { time: number }[]) => {
    world.views++;
    const blank = world.views <= world.blankViews;
    return frames.map((f) => ({ time: f.time, lumaStd: blank ? 0 : 40, whiteShare: 0 }));
  }
}));
vi.mock('$lib/server/motion/templates', () => ({ templateLibrary: () => ({ list: async () => [] }) }));
vi.mock('$lib/server/motion/brand-sources', async () => {
  const { pageOf } = await import('./site-copy');
  return { brandSources: () => (world.scripting ? { site: async () => ({ ok: true, site: { url: SITE, logos: [], pages: [pageOf(SITE, `<h1>${PROMISE}</h1>`)] } }) } : {}) };
});

const { startMotionTurn, Browser, MAX_DELIVERY_ATTEMPTS } = await import('./turn');

async function turn(reasoning: string | null = 'low', browser = Browser.Attached) {
  const db = { storage: { from: () => ({}) } } as never;
  const motion = { record: { id: 'n-1', canvasId: 'c-1' }, node: { id: 'n-1', format: MotionFormat.Landscape, docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null } } as never;
  const started = await startMotionTurn({ db, userId: 'u-1', orgId: 'o-1', project: { id: 'p-1', brandId: null }, motion, message: 'make it pop', selection: [], model: 'anthropic/claude-opus-5.5', reasoning, requester: { kind: 'user', id: 'u-1' }, browser });
  if (started instanceof Response) {
    throw new Error('turn refused');
  }
  const reader = started.stream.getReader();
  while (!(await reader.read()).done) {
    continue;
  }
  return started.done;
}

async function leftAfterFirstChunk(browser = Browser.Absent) {
  const db = { storage: { from: () => ({}) } } as never;
  const motion = { record: { id: 'n-1', canvasId: 'c-1' }, node: { id: 'n-1', format: MotionFormat.Landscape, docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null } } as never;
  const started = await startMotionTurn({ db, userId: 'u-1', orgId: 'o-1', project: { id: 'p-1', brandId: null }, motion, message: 'make it pop', selection: [], model: 'anthropic/claude-opus-5.5', reasoning: 'low', requester: { kind: 'user', id: 'u-1' }, browser });
  if (started instanceof Response) {
    throw new Error('turn refused');
  }
  const reader = started.stream.getReader();
  await reader.read();
  await reader.cancel();
  return started.done;
}

const viewedAfterLastEdit = () => world.toolCalls.lastIndexOf('view_frames') > world.toolCalls.lastIndexOf('add_clip');

describe('a motion turn closes on a look and a summary', () => {
  beforeEach(() => {
    world.calls = [];
    world.toolCalls = [];
    world.saved = [];
    world.nudgesToIgnore = 0;
    world.rate = 1;
    world.models = [];
    world.visionFails = false;
    world.seesImages = false;
    world.viewsWhileEditing = false;
    world.blankViews = 0;
    world.views = 0;
    world.scripting = false;
    world.awaited = 0;
  });

  it('looks at its frames after the last edit even when the edits spent the whole budget', async () => {
    world.rate = 1_000_000;

    await turn();

    expect(viewedAfterLastEdit()).toBe(true);
  });

  it('nudges again when the model ignores the first request to look', async () => {
    world.nudgesToIgnore = 1;

    await turn();

    expect(viewedAfterLastEdit()).toBe(true);
  });

  it('a step that fails after the edits keeps them in the conversation: the summary sees the work', async () => {
    world.visionFails = true;
    world.viewsWhileEditing = true;

    await turn();
    const summary = world.calls.find((c) => c.toolChoice?.type === 'none')!;

    expect(JSON.stringify(summary.prompt.filter((m) => m.role !== 'system'))).toContain('add_clip');
  });

  it('a turn on a model that reads images looks at its frames with that same model', async () => {
    world.seesImages = true;

    await turn();

    expect(world.models).not.toContain('vision/model');
    expect(viewedAfterLastEdit()).toBe(true);
  });

  it('never forces a tool while reasoning is on: providers refuse tool_choice with thinking', async () => {
    await turn('low');

    expect(world.calls.some((c) => c.toolChoice?.type === 'tool')).toBe(false);
  });

  it('a turn cut by its budget in the middle of the work still ends on a summary, and the notes keep their spacing', async () => {
    world.rate = 1_000_000;

    const outcome = await turn('low', Browser.Absent);
    const saved = world.saved.find((t) => t.role === 'assistant')!.content!;

    expect(outcome.reply.trim().endsWith(SUMMARY)).toBe(true);
    expect(saved.trim().endsWith(SUMMARY)).toBe(true);
    expect(saved).not.toMatch(/\.[A-Z]/);
  });

  it('a check that ends on its own words is the summary: no extra step resends the turn', async () => {
    await turn();

    expect(world.calls.some((c) => c.toolChoice?.type === 'none')).toBe(false);
    expect(world.calls.at(-1)!.prompt.some((m) => m.role === 'user' && /summary/i.test(textOf(m)))).toBe(true);
  });

  it('a gate error seen in the last look keeps the turn open: it asks for a fix and another look', async () => {
    world.blankViews = 1;

    await turn();
    const asked = world.calls.flatMap((c) => c.prompt).filter((m) => m.role === 'user').map(textOf);

    expect(world.toolCalls.filter((t) => t === 'view_frames')).toHaveLength(2);
    expect(asked.some((t) => /flat colour/.test(t))).toBe(true);
  });

  it('gate errors that survive every attempt are delivered, and the reply says what stays open', async () => {
    world.blankViews = 1_000;

    const outcome = await turn();

    expect(world.toolCalls.filter((t) => t === 'view_frames')).toHaveLength(MAX_DELIVERY_ATTEMPTS);
    expect(outcome.reply).toMatch(/still open/i);
    expect(outcome.reply).toMatch(/flat colour/);
  });

  it('stops after the script is saved: the user reads the brief before anything is built', async () => {
    world.scripting = true;

    const outcome = await turn();

    expect(world.toolCalls).toEqual(['analyze_site', 'write_script']);
    expect(world.calls.some((c) => c.toolChoice?.type === 'none')).toBe(false);
    expect(outcome.reply).not.toMatch(/still open/i);
  });

  it('a client that leaves mid-stream does not stop the turn: the answer is still saved', async () => {
    const outcome = await leftAfterFirstChunk();

    expect(outcome.reply.trim().length).toBeGreaterThan(0);
    expect(world.saved.find((t) => t.role === 'assistant')?.content).toBe(outcome.reply);
  });

  it('a client that left is not waited on for frames: the look is skipped without an error and the turn closes', async () => {
    const outcome = await leftAfterFirstChunk(Browser.Attached);

    expect(world.toolCalls).toContain('view_frames');
    expect(world.awaited).toBe(0);
    expect(outcome.reply.trim().length).toBeGreaterThan(0);
  });
});
