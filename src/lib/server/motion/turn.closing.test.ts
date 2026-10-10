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
  saved: [] as { role: string; content?: string; status?: string }[],
  progress: [] as { content: string; tools: unknown[] }[],
  nudgesToIgnore: 0,
  rate: 1,
  models: [] as string[],
  visionFails: false,
  seesImages: false,
  viewsWhileEditing: false,
  blankViews: 0,
  views: 0,
  scripting: false,
  awaited: 0,
  conflicts: 0,
  writes: [] as { expectedVersion: number }[],
  chunks: [] as { type: string; data?: unknown }[],
  hangsAfterEdit: false,
  stored: new Map<string, string>(),
  removed: [] as string[],
  stopped: false,
  picking: false,
  looking: false,
  message: 'make it pop',
  history: [] as { role: string; content: string }[],
  tools: [] as string[][],
  imported: [] as string[]
}));

const draftBucket = {
  upload: async (path: string, bytes: Buffer) => {
    world.stored.set(path, bytes.toString());
    return { error: null };
  },
  remove: async (paths: string[]) => {
    world.removed.push(...paths);
    paths.forEach((p) => world.stored.delete(p));
    return { error: null };
  },
  list: async () => ({ data: [], error: null }),
  download: async () => ({ data: null, error: null })
};

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

const PICK = { question: 'Which look is yours?', candidates: Array.from({ length: 6 }, (_, i) => ({ id: `pin${i}`, image: `https://i.pinimg.com/${i}.jpg`, title: `Pin ${i}` })) };
const LOOK = { typeScale: 0.4, bleed: false, columns: 2, smallText: 'some', palette: ['#111111'], font: 'grotesk', imagery: 'none' };

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
  if (world.picking && last.role === 'user') {
    return tool('ask_reference_pick', PICK);
  }
  if (world.looking && last.role === 'user') {
    return tool('set_reference_look', LOOK);
  }
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
      world.tools.push((options.tools ?? []).map((t) => (t as { name: string }).name));
      world.calls.push(call);
      if (world.hangsAfterEdit && lastMessage(call.prompt).role === 'tool') {
        return { stream: new ReadableStream({ start() {} }) };
      }
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
  loadTurns: async () => world.history,
  promptHistory: (turns: unknown) => turns,
  saveTurn: async (_db: unknown, turn: { role: string; content?: string }) => {
    world.saved.push(turn);
  }
}));
vi.mock('$lib/server/repos/chat-reply', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/chat-reply')>()),
  openReply: async () => ({
    progress: async (body: { content: string; tools: unknown[] }) => {
      world.progress.push(body);
    },
    finish: async (body: { content: string }, status: string) => {
      world.saved.push({ role: 'assistant', ...body, status });
    },
    stopped: async () => world.stopped
  })
}));
vi.mock('$lib/server/motion/editor', () => ({
  headOrNew: async () => ({ version: 0, doc: { ...newMotionDoc(MotionFormat.Landscape), style: MotionStyle.AppleMinimal }, summary: null, actorKind: 'system' }),
  motionTokens: async () => ({ name: 'Brand' }),
  motionAssets: async () => [],
  assetUrls: () => ({}),
  saveMotionDoc: async (_db: unknown, input: { expectedVersion: number }) => {
    world.writes.push(input);
    if (world.conflicts > 0) {
      world.conflicts--;
      return { outcome: 'conflict' };
    }
    return { outcome: 'written', head: { version: input.expectedVersion + 1, doc: {}, summary: null, actorKind: 'agent' } };
  },
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
  const importAsset = async (url: string) => {
    world.imported.push(url);
    return { ok: true, asset: { id: `asset-${world.imported.length}`, kind: 'image', label: url, previewUrl: '', url }, width: 10, height: 10 };
  };
  return { brandSources: () => (world.scripting ? { importAsset, site: async () => ({ ok: true, site: { url: SITE, logos: [], pages: [pageOf(SITE, `<h1>${PROMISE}</h1>`)] } }) } : { importAsset }) };
});

const { startMotionTurn, Browser, MAX_DELIVERY_ATTEMPTS } = await import('./turn');
const { DOC_EDITED } = await import('$lib/motion/frames-request');
type DocEdited = import('$lib/motion/frames-request').DocEdited;

async function turn(reasoning: string | null = 'low', browser = Browser.Attached, landingMs?: number, stopPollMs = 3000) {
  const db = { storage: { from: () => draftBucket } } as never;
  const motion = { record: { id: 'n-1', canvasId: 'c-1' }, node: { id: 'n-1', format: MotionFormat.Landscape, docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null } } as never;
  const started = await startMotionTurn({ db, userId: 'u-1', orgId: 'o-1', project: { id: 'p-1', brandId: null }, motion, message: world.message, selection: [], model: 'anthropic/claude-opus-5.5', reasoning, requester: { kind: 'user', id: 'u-1' }, browser, ...(landingMs === undefined ? {} : { timing: { landingMs, stopPollMs } }) });
  if (started instanceof Response) {
    throw new Error('turn refused');
  }
  if (landingMs !== undefined) {
    void started.stream.pipeTo(new WritableStream({ write: (c) => void world.chunks.push(c as { type: string }) })).catch(() => {});
    return started.done;
  }
  const reader = started.stream.getReader();
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    world.chunks.push(next.value as { type: string; data?: unknown });
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
    world.progress = [];
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
    world.conflicts = 0;
    world.writes = [];
    world.chunks = [];
    world.hangsAfterEdit = false;
    world.stored = new Map();
    world.removed = [];
    world.stopped = false;
    world.picking = false;
    world.looking = false;
    world.message = 'make it pop';
    world.history = [];
    world.tools = [];
    world.imported = [];
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

  it('a model that ignores every request to look is shown its last frames before it sums up', async () => {
    world.nudgesToIgnore = 1_000;

    const outcome = await turn();
    const summed = world.calls.at(-1)!.prompt;

    expect(world.views).toBe(1);
    expect(summed.some(hasImage) || JSON.stringify(summed).includes('"type":"file"')).toBe(true);
    expect(outcome.reply.trim().length).toBeGreaterThan(0);
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

  it('each finished step is written as progress before the answer is closed done', async () => {
    const outcome = await turn();

    expect(world.progress.length).toBeGreaterThan(1);
    expect(world.progress.some((p) => p.tools.length > 0)).toBe(true);
    expect(world.saved.filter((t) => t.role === 'assistant')).toEqual([expect.objectContaining({ content: outcome.reply, status: 'done' })]);
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

  it('stops after asking which references to follow: nothing is built or spent before the user picks', async () => {
    world.picking = true;

    const outcome = await turn();

    expect(world.toolCalls).toEqual(['ask_reference_pick']);
    expect(world.calls.some((c) => c.toolChoice?.type === 'none')).toBe(false);
    expect(outcome.reply).not.toMatch(/still open/i);
    expect(outcome.pick?.candidates).toHaveLength(6);
  });

  it('a user who said "scegli tu" is never asked to pick', async () => {
    world.message = 'trova riferimenti su pinterest, scegli tu';

    await turn();

    expect(world.tools[0]).not.toContain('ask_reference_pick');
    world.message = 'trova riferimenti su pinterest';
    world.tools = [];
    await turn();
    expect(world.tools[0]).toContain('ask_reference_pick');
  });

  it('the look records the references the user avoided, as what not to do', async () => {
    const { answerText, Mark } = await import('$lib/reference-pick');
    world.message = answerText({ ...PICK, min: 1, max: 6 }, { pin0: Mark.Follow, pin1: Mark.Follow, pin2: Mark.Follow, pin3: Mark.Avoid }, '');
    world.looking = true;

    await turn();

    const doc = (world.chunks.findLast((c) => c.type === DOC_EDITED)?.data as DocEdited).doc;
    expect(doc.referenceLook?.avoid?.map((a) => a.image)).toEqual(['https://i.pinimg.com/3.jpg']);
  });

  it('the pick answer imports the followed references, only those, and names their assets to the model', async () => {
    const { answerText, Mark } = await import('$lib/reference-pick');
    world.message = answerText({ ...PICK, min: 1, max: 6 }, { pin0: Mark.Follow, pin1: Mark.Follow, pin2: Mark.Follow, pin3: Mark.Avoid }, '');

    await turn();

    expect(world.imported).toEqual(['https://i.pinimg.com/0.jpg', 'https://i.pinimg.com/1.jpg', 'https://i.pinimg.com/2.jpg']);
    expect(JSON.stringify(world.calls[0].prompt)).toContain('asset-3');
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

  it('every applied edit reaches the editor as it lands, numbered in order, before the turn ends', async () => {
    await turn();
    const edits = world.chunks.filter((c) => c.type === DOC_EDITED).map((c) => (c.data as DocEdited).edit);
    const finish = world.chunks.findIndex((c) => c.type === 'finish');
    const lastEdit = world.chunks.findLastIndex((c) => c.type === DOC_EDITED);

    expect(edits).toEqual([1]);
    expect(lastEdit).toBeLessThan(finish);
    expect((world.chunks[lastEdit].data as DocEdited).doc.tracks.some((t) => t.clips.length)).toBe(true);
  });

  it('a save refused by a newer head is retried on that head: the agent work is never dropped', async () => {
    world.conflicts = 1;

    const outcome = await turn();

    expect(world.writes).toHaveLength(2);
    expect(outcome.revision).toBe('written');
  });

  it('a save refused again and again is retried until it lands: no browser is needed to keep the agent work', async () => {
    world.conflicts = 2;

    const outcome = await turn();

    expect(outcome.revision).toBe('written');
  });

  it('a turn the platform is about to cut lands its edits and closes its answer before the wall', async () => {
    world.hangsAfterEdit = true;

    const outcome = await turn('low', Browser.Attached, 200);
    const written = world.writes.at(-1) as unknown as { doc: { tracks: { clips: unknown[] }[] } };

    expect(outcome.revision).toBe('written');
    expect(written.doc.tracks.some((t) => t.clips.length)).toBe(true);
    expect(world.saved.filter((t) => t.role === 'assistant')).toHaveLength(1);
  });

  it('the working doc is kept on the server as each edit lands, so a reload mid-turn sees it', async () => {
    world.hangsAfterEdit = true;

    void turn('low', Browser.Attached, 60_000);
    await vi.waitFor(() => expect(world.stored.size).toBe(1));
    const [path, body] = [...world.stored][0];
    const draft = JSON.parse(body) as DocEdited;

    expect(path).toBe('o-1/p-1/motion-drafts/n-1.json');
    expect(draft.edit).toBe(1);
    expect(draft.doc.tracks.some((t) => t.clips.length)).toBe(true);
  });

  it('the working doc is dropped once the turn has landed its revision', async () => {
    await turn();

    expect(world.stored.size).toBe(0);
    expect(world.removed).toContain('o-1/p-1/motion-drafts/n-1.json');
  });

  it('a turn stopped from the chat ends at once and still keeps the edits it made', async () => {
    world.hangsAfterEdit = true;

    const ended = turn('low', Browser.Attached, 60_000, 10);
    await vi.waitFor(() => expect(world.stored.size).toBe(1));
    world.stopped = true;
    const outcome = await ended;

    expect(outcome.revision).toBe('written');
  });
});
