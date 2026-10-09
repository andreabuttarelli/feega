import { describe, expect, it, vi } from 'vitest';
import { generateText, stepCountIs, type Tool } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { MAX_SEARCHES_PER_TURN, MAX_SHOTS_PER_TURN, WEB_TOOLS, createWebTools, type WebToolDeps } from './web-tools';
import { ShotView } from './screenshot';
import { StoreKind } from './store';
import { ViewDetail } from './view-images';

type Exec = (input: unknown, options: { toolCallId: string }) => Promise<Record<string, unknown>>;

const RESULT = { title: 'A', url: 'https://a.example/', snippet: 's', date: null };

function setup(over: Partial<WebToolDeps> = {}) {
  let spent = 0;
  const deps: WebToolDeps = {
    search: vi.fn(async () => ({ ok: true as const, results: [RESULT], costUsd: 0.007 })),
    read: vi.fn(async (url: string) => ({ ok: true as const, url, title: 'T', markdown: '# T', images: [], links: [], truncated: false })),
    shoot: vi.fn(async () => ({ ok: true as const, jpeg: Buffer.from('jpg'), width: 1280, height: 800 })),
    store: vi.fn(async () => ({ ok: true as const, platform: StoreKind.Shopify, store: 'https://shop.example', products: [], truncated: false })),
    spend: (usd) => {
      spent += usd;
    },
    ...over
  };
  const tools = createWebTools(deps);
  const run = (name: string, input: unknown, toolCallId = 'c') => (tools[name] as Tool & { execute: Exec }).execute(input, { toolCallId });
  return { deps, tools, run, spent: () => spent };
}

describe('web tools', () => {
  it('web_search returns the results and adds the call cost to the turn', async () => {
    const { run, spent, deps } = setup();

    expect(await run('web_search', { query: 'stripe brand colours', max_results: 3 })).toEqual({ ok: true, results: [RESULT] });
    await run('web_search', { query: 'again' });

    expect(deps.search).toHaveBeenCalledWith('stripe brand colours', 3);
    expect(spent()).toBeCloseTo(0.014);
  });

  it('a failed search costs nothing and says why', async () => {
    const { run, spent } = setup({ search: vi.fn(async () => ({ ok: false as const, error: 'web search failed: down' })) });

    expect(await run('web_search', { query: 'q' })).toEqual({ ok: false, error: 'web search failed: down' });
    expect(spent()).toBe(0);
  });

  it('caps the searches of one turn', async () => {
    const { run, deps } = setup();
    for (let i = 0; i < MAX_SEARCHES_PER_TURN; i++) {
      await run('web_search', { query: `q${i}` });
    }

    expect(await run('web_search', { query: 'one more' })).toMatchObject({ ok: false });
    expect(deps.search).toHaveBeenCalledTimes(MAX_SEARCHES_PER_TURN);
  });

  it('read_page hands the page read to the model', async () => {
    const { run } = setup();

    expect(await run('read_page', { url: 'https://a.example/' })).toMatchObject({ ok: true, markdown: '# T' });
  });

  it('screenshot_page shows the picture to the model, capped per turn', async () => {
    const { run, tools, deps } = setup();

    const out = await run('screenshot_page', { url: 'https://a.example/', viewport: ShotView.Mobile }, 's1');
    const model = await (tools.screenshot_page.toModelOutput as (o: unknown) => Promise<{ type: string; value: { type: string; mediaType?: string }[] }>)({ toolCallId: 's1', input: {}, output: out });

    expect(deps.shoot).toHaveBeenCalledWith('https://a.example/', ShotView.Mobile);
    expect(out).toEqual({ ok: true, url: 'https://a.example/', width: 1280, height: 800 });
    expect(model.type).toBe('content');
    expect(model.value.some((p) => p.type === 'file' && p.mediaType === 'image/jpeg')).toBe(true);

    for (let i = 1; i < MAX_SHOTS_PER_TURN; i++) {
      await run('screenshot_page', { url: 'https://a.example/' }, `s${i + 1}`);
    }
    expect(await run('screenshot_page', { url: 'https://a.example/' }, 'last')).toMatchObject({ ok: false });
  });

  it('leaves out screenshot_page and import_image when there is nothing behind them', () => {
    const { tools } = setup({ shoot: undefined });

    expect(Object.keys(tools).sort()).toEqual(['read_page', 'read_store', 'web_search']);
  });

  it('import_image saves the picture as a project asset', async () => {
    const importImage = vi.fn(async () => ({ ok: true as const, assetId: 'a1', width: 10, height: 20 }));
    const { run } = setup({ importImage });

    expect(await run('import_image', { url: 'https://a.example/x.png' })).toEqual({ ok: true, asset_id: 'a1', width: 10, height: 20 });
    expect(WEB_TOOLS).toContain('import_image');
  });

  it('read_store lists the products of a store, capped by max_items', async () => {
    const { run, deps } = setup();

    expect(await run('read_store', { url: 'shop.example', max_items: 10 })).toMatchObject({ ok: true, platform: 'shopify' });
    expect(deps.store).toHaveBeenCalledWith('shop.example', { max: 10, category: undefined });
  });

  it('import_products saves the chosen products and reports what is missing', async () => {
    const importProducts = vi.fn(async () => ({ ok: true as const, products: [{ handle: 'a', title: 'A', asset_ids: ['x1'] }], missing: ['b'], node_id: 'n1' }));
    const { run } = setup({ importProducts });

    expect(await run('import_products', { store_url: 'https://shop.example', handles: ['a', 'b'] })).toEqual({ ok: true, products: [{ handle: 'a', title: 'A', asset_ids: ['x1'] }], missing: ['b'], node_id: 'n1' });
    expect(importProducts).toHaveBeenCalledWith('https://shop.example', ['a', 'b']);
  });

  it('view_images hands the model real image parts, and keeps only paths in its record', async () => {
    const view = vi.fn(async () => ({ images: [{ url: 'https://a.example/p.png', path: 'o/p/web-views/c/0.jpg', width: 10, height: 10 }], parts: [{ mediaType: 'image/jpeg', data: 'AAAA' }] }));
    const { tools } = setup({ view });
    const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
    const prompts: unknown[] = [];
    let call = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async (options: { prompt: unknown }) => {
        prompts.push(options.prompt);
        call++;
        return call === 1
          ? { content: [{ type: 'tool-call', toolCallId: 'v1', toolName: 'view_images', input: JSON.stringify({ urls: ['https://a.example/p.png'] }) }], finishReason: { unified: 'tool-calls', raw: 'tool_calls' }, usage, warnings: [] }
          : { content: [{ type: 'text', text: 'seen' }], finishReason: { unified: 'stop', raw: 'stop' }, usage, warnings: [] };
      }
    } as never);

    const result = await generateText({ model, tools, prompt: 'look', stopWhen: stepCountIs(3) });

    expect(view).toHaveBeenCalledWith(['https://a.example/p.png'], ViewDetail.High, 'v1');
    expect(JSON.stringify(prompts[1])).toContain('image/jpeg');
    expect(JSON.stringify(prompts[1])).toContain('AAAA');
    const recorded = result.steps[0].toolResults[0].output;
    expect(recorded).toEqual({ ok: true, images: [{ url: 'https://a.example/p.png', path: 'o/p/web-views/c/0.jpg', width: 10, height: 10 }] });
    expect(JSON.stringify(recorded)).not.toContain('AAAA');
  });
});

