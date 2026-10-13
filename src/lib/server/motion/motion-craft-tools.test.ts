import { describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { GLOBE_TEMPLATE_ID } from '$lib/motion/template/image-globe/template';
import { motionAgentPrompt } from './motion-prompt';
import { Vision } from './frames';
import { createMotionTools, type MotionToolDeps, type MotionSession } from './motion-tools';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

async function outputsOf(result: unknown): Promise<Record<string, unknown>[]> {
  if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
    const all: Record<string, unknown>[] = [];
    for await (const out of result as AsyncIterable<Record<string, unknown>>) {
      all.push(out);
    }
    return all;
  }
  return [(await result) as Record<string, unknown>];
}

function setup(over: Partial<MotionToolDeps> = {}) {
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Landscape), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const save = vi.fn(async () => ({ ok: true as const, entry: { id: 'saved-1', template: BUILTIN_TEMPLATES[0].template } }));
  const templates = { list: async () => BUILTIN_TEMPLATES, save, remove: async () => false };
  const tools = createMotionTools({ session, assets: [], newId: () => 'id1', voiceover: vi.fn(), frames: vi.fn(), check: vi.fn(), templates, ...over });
  const run = async (name: string, input: unknown) => (await outputsOf((tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' }))).at(-1)!;
  const outputs = async (name: string, input: unknown) => outputsOf((tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId: 'c' }));
  return { session, run, outputs, save, tools };
}

describe('read_template_source', () => {
  it('returns the code of a library template to learn from', async () => {
    const { run } = setup();

    expect(await run('read_template_source', { id: GLOBE_TEMPLATE_ID })).toMatchObject({ ok: true, name: 'Image globe', components: [expect.objectContaining({ name: 'ImageGlobe' })] });
  });

  it('names the templates there are when the id is wrong', async () => {
    const { run } = setup();

    expect(await run('read_template_source', { id: 'nope' })).toMatchObject({ ok: false, error: expect.stringContaining(GLOBE_TEMPLATE_ID) });
  });
});

describe('check_motion', () => {
  it('draws consecutive frames and reports where the motion jolts', async () => {
    const frames = vi.fn(async (_id: string, times: number[]) => times.map((time) => ({ time, bytes: Buffer.from([1]) })));
    const levels = [0, 1, 2, 3, 4, 5, 15, 16, 17, 18, 19, 20];
    const lumas = vi.fn(async () => levels.map((l) => new Uint8Array(4).fill(l)));
    const { run } = setup({ frames, lumas });

    const out = await run('check_motion', { from: 0, frames: levels.length });

    expect(frames.mock.calls[0][1]).toHaveLength(levels.length);
    expect(out).toMatchObject({ ok: true, jolts: [{ kind: 'pop' }] });
  });

  it('says so when no frames could be drawn', async () => {
    const { run } = setup({ frames: vi.fn(async () => null), lumas: vi.fn() });

    expect(await run('check_motion', { from: 0 })).toMatchObject({ ok: false });
  });
});

describe('craft_composition', () => {
  it('hands the brief to the crafting agent and returns its rounds and contact sheets', async () => {
    const craft = vi.fn(async () => ({ ok: true as const, rounds: 3, cost_usd: 1.9, text: 'done', images: [{ path: 'org/p/uploads/web-views/v1/sheet.jpg', round: 1 }] }));
    const { run } = setup({ craft });

    const out = await run('craft_composition', { brief: 'iridescent blobs behind a title', reference_asset_ids: ['a1'] });

    expect(craft).toHaveBeenCalledWith(expect.objectContaining({ brief: 'iridescent blobs behind a title', rounds: 4, budget_usd: 2 }), expect.any(Function));
    expect(out).toMatchObject({ ok: true, rounds: 3, images: [{ path: 'org/p/uploads/web-views/v1/sheet.jpg' }] });
  });

  it('the crafting agent can use the editing tools while craft_composition is still running', async () => {
    let tools: Record<string, Tool> = {};
    const craft = vi.fn(async () => {
      const doc = await (tools.get_motion_doc as Tool & { execute: Exec }).execute({}, { toolCallId: 'child' });
      return { ok: true as const, rounds: doc ? 1 : 0, cost_usd: 0, text: '', images: [] };
    });
    const s = setup({ craft });
    tools = s.tools;

    const out = await Promise.race([s.run('craft_composition', { brief: 'a slow aurora behind a title', reference_asset_ids: ['a1'] }), new Promise((r) => setTimeout(() => r('deadlock'), 500))]);

    expect(out).toMatchObject({ ok: true, rounds: 1 });
  });

  it('a spawned sub-agent can use the editing tools while spawn_agent is still running', async () => {
    let tools: Record<string, Tool> = {};
    const spawnRun = vi.fn(async () => {
      await (tools.get_motion_doc as Tool & { execute: Exec }).execute({}, { toolCallId: 'child' });
      return { ok: true as const, label: 'x', model: 'm', prompt: 'p', text: 'done', cost_usd: 0, changed: [] };
    });
    const s = setup({ spawn: { offers: [], run: spawnRun } });
    tools = s.tools;

    const out = await Promise.race([s.run('spawn_agent', { prompt: 'look at the doc and report', budget_usd: 0.1 }), new Promise((r) => setTimeout(() => r('deadlock'), 500))]);

    expect(out).toMatchObject({ ok: true, text: 'done' });
  });

  it('the chat agent is told to hand a reference composition to the crafting agent, not write it in one shot', () => {
    expect(motionAgentPrompt({ brandName: null, selectionNote: '', vision: Vision.Available })).toMatch(/craft_composition with the reference asset ids/);
  });

  it('streams each closed round to the chat before the final result', async () => {
    const round = { ok: true as const, running: true as const, rounds: 1, best_score: 6, log: [], images: [] };
    const craft = vi.fn(async (_input: unknown, progress?: (u: typeof round) => void) => {
      progress?.(round);
      return { ok: true as const, rounds: 1, best_score: 6, cost_usd: 1, budget_usd: 2, text: 'done', images: [], log: [] };
    });
    const { outputs } = setup({ craft });

    const all = await outputs('craft_composition', { brief: 'a slow aurora behind a title', reference_asset_ids: ['a1'] });

    expect(all.map((o) => o.running ?? false)).toEqual([true, false]);
  });

  it('is not offered where no crafting agent runs', () => {
    expect(setup().tools.craft_composition).toBeUndefined();
  });
});

describe('save_template key fields', () => {
  it('passes the key fields the agent names to the library', async () => {
    const { run, save } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 2, props: { text: 'Hello' } });
    await run('expose_field', { key: 'headline', label: 'Headline', type: 'text', clip_id: 'id1', prop: 'text' });

    await run('save_template', { name: 'Hello', key_fields: ['headline'] });

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ meta: expect.objectContaining({ keyFields: ['headline'] }) }));
  });
});

describe('shortening the one clip to the length asked', () => {
  it('set_timing to 8 s leaves an 8 s video, not 8 s plus a hold the brief never asked for (eval craft: 8.6 s)', async () => {
    const { run, session } = setup();
    await run('add_clip', { component: 'Title', start: 0, duration: 8.5, props: { text: 'slow light' } });
    await run('set_canvas', { duration: 8.5 });

    await run('set_timing', { clip_id: 'id1', duration: 8 });

    expect(session.doc.durationInFrames / session.doc.fps).toBe(8);
    expect(await run('set_canvas', { duration: 8 })).toMatchObject({ ok: true });
  });
});
