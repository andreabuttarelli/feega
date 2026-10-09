import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText, stepCountIs, type ModelMessage } from 'ai';
import { PromptCache } from '../prompt-cache';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { VIEW_FRAMES } from './frames';
import type { MotionSession, MotionToolDeps } from './motion-tools';

const M = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  fetch: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({ env: M.env }));
vi.mock('$lib/server/ai-log', () => ({ logAiCall: vi.fn(), extractSdkUsage: () => ({}), noteLlmCost: vi.fn() }));

const MODEL = 'anthropic/claude-opus-5.5';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
const JSON_HEADERS = { 'content-type': 'application/json' };

const reply = (output: unknown[]) => ({ id: 'r', created_at: 0, model: MODEL, output, usage: { input_tokens: 1, output_tokens: 1 } });
const CALL = reply([{ type: 'function_call', id: 'fc', call_id: 'call_1', name: VIEW_FRAMES, arguments: '{"times":[2]}', status: 'completed' }]);
const DONE = reply([{ type: 'message', id: 'm', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'seen', annotations: [] }] }]);

const bodies = () => M.fetch.mock.calls.map((c) => JSON.stringify(JSON.parse((c[1] as RequestInit).body as string).input));

async function motionTools() {
  const { createMotionTools } = await import('./motion-tools');
  const session: MotionSession = { doc: newMotionDoc(MotionFormat.Vertical), baseVersion: 1, edits: [], selection: [], frames: new Map(), views: 0, checkedAt: 0, codeWrites: 0 };
  const deps = { session, assets: [], newId: () => 'id', frames: async (_id: string, times: number[]) => times.map((time) => ({ time, bytes: JPEG })), check: async () => null } as unknown as MotionToolDeps;
  return createMotionTools(deps);
}

describe('the frames of view_frames reach the model on the wire', () => {
  beforeEach(() => {
    vi.resetModules();
    M.fetch.mockReset();
    Object.assign(M.env, { LLM_API_KEY: 'k', LLM_DEFAULT_MODEL: MODEL });
    const answers = [CALL, DONE];
    M.fetch.mockImplementation(async () => new Response(JSON.stringify(answers.shift() ?? DONE), { status: 200, headers: JSON_HEADERS }));
    vi.stubGlobal('fetch', M.fetch);
  });

  it('the step after view_frames sends the drawn frame as an image', async () => {
    const { llmLanguageModel } = await import('../llm');
    const tools = await motionTools();

    await generateText({ model: llmLanguageModel(MODEL, PromptCache.On), prompt: 'look', tools, stopWhen: stepCountIs(2) });

    expect(bodies()[1]).toContain('input_image');
    expect(bodies()[1]).toContain(JPEG.toString('base64'));
  });

  it('the next round of the same turn still carries the frames a view drew', async () => {
    const { llmLanguageModel } = await import('../llm');
    const tools = await motionTools();

    const first = await generateText({ model: llmLanguageModel(MODEL, PromptCache.On), prompt: 'look', tools, stopWhen: stepCountIs(1) });
    const next: ModelMessage[] = [{ role: 'user', content: 'look' }, ...first.response.messages, { role: 'user', content: 'Not deliverable yet: fix it' }];
    await generateText({ model: llmLanguageModel(MODEL, PromptCache.On), messages: next, tools });

    expect(bodies().at(-1)).toContain(JPEG.toString('base64'));
  });
});
