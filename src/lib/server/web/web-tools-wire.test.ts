import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText, stepCountIs } from 'ai';
import { PromptCache } from '../prompt-cache';
import type { WebToolDeps } from './web-tools';

const M = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  fetch: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({ env: M.env }));
vi.mock('$lib/server/ai-log', () => ({ logAiCall: vi.fn(), extractSdkUsage: () => ({}), noteLlmCost: vi.fn() }));

const MODEL = 'anthropic/claude-opus-5.5';
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 8, 7, 0xff, 0xd9]);
const PIXELS = JPEG.toString('base64');
const PICTURE = 'https://shop.example/cdn/shoe.jpg';
const JSON_HEADERS = { 'content-type': 'application/json' };

const reply = (output: unknown[]) => ({ id: 'r', created_at: 0, model: MODEL, output, usage: { input_tokens: 1, output_tokens: 1 } });
const call = (name: string, input: unknown) => reply([{ type: 'function_call', id: 'fc', call_id: 'call_1', name, arguments: JSON.stringify(input), status: 'completed' }]);
const DONE = reply([{ type: 'message', id: 'm', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'seen', annotations: [] }] }]);

const viewed = { images: [{ url: PICTURE, path: 'p/0.jpg', width: 1, height: 1 }], parts: [{ mediaType: 'image/jpeg', data: PIXELS }] };

const deps: WebToolDeps = {
  search: vi.fn(),
  read: vi.fn(),
  store: vi.fn(),
  spend: vi.fn(),
  view: vi.fn(async () => viewed),
  shoot: vi.fn(async () => ({ ok: true as const, jpeg: JPEG, width: 1280, height: 800 })),
  browse: vi.fn(async () => ({ ok: true as const, url: PICTURE, steps: [], shots: [{ jpeg: JPEG, path: null }], costUsd: 0 })),
  importImage: vi.fn(async () => ({ ok: true as const, assetId: 'a1', width: 1, height: 1 })),
  importProducts: vi.fn(async () => ({ ok: true as const, products: [{ handle: 'shoe', title: 'Shoe', asset_ids: ['a2'], pictures: [PICTURE] }], missing: [] }))
};

const SEES_PIXELS: [string, unknown][] = [
  ['view_images', { urls: [PICTURE] }],
  ['screenshot_page', { url: 'https://shop.example' }],
  ['browse', { url: 'https://shop.example', steps: [] }],
  ['import_image', { url: PICTURE }],
  ['import_products', { store_url: 'https://shop.example', handles: ['shoe'] }]
];

describe('every web tool that handles a picture sends its pixels to the model', () => {
  beforeEach(() => {
    vi.resetModules();
    M.fetch.mockReset();
    Object.assign(M.env, { LLM_API_KEY: 'k', LLM_DEFAULT_MODEL: MODEL });
    vi.stubGlobal('fetch', M.fetch);
  });

  it.each(SEES_PIXELS)('%s', async (name, input) => {
    const answers = [call(name, input), DONE];
    M.fetch.mockImplementation(async () => new Response(JSON.stringify(answers.shift() ?? DONE), { status: 200, headers: JSON_HEADERS }));
    const { llmLanguageModel } = await import('../llm');
    const { createWebTools } = await import('./web-tools');

    await generateText({ model: llmLanguageModel(MODEL, PromptCache.On), prompt: 'look', tools: createWebTools(deps), stopWhen: stepCountIs(2) });

    const sent = JSON.stringify(JSON.parse((M.fetch.mock.calls[1][1] as RequestInit).body as string).input);
    expect(sent).toContain('input_image');
    expect(sent).toContain(PIXELS);
  });
});
