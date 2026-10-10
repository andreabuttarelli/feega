import { describe, expect, it, vi } from 'vitest';
import { generateText, stepCountIs, type Tool } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { MAX_BROWSES_PER_TURN, MAX_PINTEREST_PER_TURN, MAX_SEARCHES_PER_TURN, MAX_SHOTS_PER_TURN, MAX_SOCIAL_PER_TURN, REFERENCE_TOOLS, WEB_GUIDANCE, WEB_TOOLS, createWebTools, type WebToolDeps } from './web-tools';
import { ShotView } from './screenshot';
import { MAX_REJECTED_ROUNDS } from '$lib/reference-pick';
import { StoreKind } from './store';
import { ViewDetail } from './view-images';
import { StepKind } from './browse';
import { SocialPlatform } from './social-search';
import { ItemKind } from './social-posts';

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

  it('browse runs the steps, shows its screenshots to the model, stores them as paths and spends what the browser cost', async () => {
    const browse = vi.fn(async () => ({
      ok: true as const,
      url: 'https://a.example/',
      steps: [{ do: StepKind.Navigate, ok: true as const }, { do: StepKind.Screenshot, ok: true as const, shot: 0 }],
      shots: [{ jpeg: Buffer.from('jpg'), path: 'org/p/web-views/b1/shot-0.jpg' }],
      costUsd: 0.004
    }));
    const { run, tools, spent } = setup({ browse });

    const out = await run('browse', { url: 'https://a.example/', steps: [{ do: 'screenshot' }] }, 'b1');
    const model = await (tools.browse.toModelOutput as (o: unknown) => Promise<{ type: string; value: { type: string; mediaType?: string }[] }>)({ toolCallId: 'b1', input: {}, output: out });

    expect(browse).toHaveBeenCalledWith('https://a.example/', [{ do: 'screenshot' }], 'b1');
    expect(out).toMatchObject({ ok: true, screenshots: ['org/p/web-views/b1/shot-0.jpg'] });
    expect(model.value.some((p) => p.type === 'file' && p.mediaType === 'image/jpeg')).toBe(true);
    expect(spent()).toBeCloseTo(0.004);

    for (let i = 1; i < MAX_BROWSES_PER_TURN; i++) {
      await run('browse', { url: 'https://a.example/', steps: [] }, `b${i + 1}`);
    }
    expect(await run('browse', { url: 'https://a.example/', steps: [] }, 'last')).toMatchObject({ ok: false });
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
    const importProducts = vi.fn(async () => ({ ok: true as const, products: [{ handle: 'a', title: 'A', asset_ids: ['x1'], pictures: [] }], missing: ['b'], node_id: 'n1' }));
    const { run } = setup({ importProducts });

    expect(await run('import_products', { store_url: 'https://shop.example', handles: ['a', 'b'] })).toEqual({ ok: true, products: [{ handle: 'a', title: 'A', asset_ids: ['x1'], pictures: [] }], missing: ['b'], node_id: 'n1' });
    expect(importProducts).toHaveBeenCalledWith('https://shop.example', ['a', 'b']);
  });

  it('pinterest_search returns the pins and spends what the requests cost, capped per turn', async () => {
    const pins = [{ id: '1', url: 'https://www.pinterest.com/pin/1/', title: 'Glass', description: null, image: { url: 'https://i.pinimg.com/originals/a.jpg', width: 10, height: 10 }, colour: '#fff', link: null, pinner: 'p', board: null }];
    const search = vi.fn(async () => ({ ok: true as const, pins, requests: 2, costUsd: 0.004 }));
    const { run, spent } = setup({ pinterest: { search, pin: vi.fn(), board: vi.fn() } });

    expect(await run('pinterest_search', { query: 'liquid glass hero', limit: 12 })).toEqual({ ok: true, pins });
    expect(search).toHaveBeenCalledWith('liquid glass hero', 12);
    expect(spent()).toBeCloseTo(0.004);

    for (let i = 1; i < MAX_PINTEREST_PER_TURN; i++) {
      await run('pinterest_search', { query: `q${i}` });
    }
    expect(await run('pinterest_search', { query: 'one more' })).toMatchObject({ ok: false });
    expect(search).toHaveBeenCalledTimes(MAX_PINTEREST_PER_TURN);
  });

  it('pinterest_pin and pinterest_board read the url given, and a failure still spends what it cost', async () => {
    const pin = vi.fn(async () => ({ ok: false as const, error: 'pinterest pin failed: 404', requests: 1, costUsd: 0.002 }));
    const board = vi.fn(async () => ({ ok: true as const, pins: [], requests: 1, costUsd: 0.002 }));
    const { run, spent } = setup({ pinterest: { search: vi.fn(), pin, board } });

    expect(await run('pinterest_pin', { url: 'https://www.pinterest.com/pin/1/' })).toEqual({ ok: false, error: 'pinterest pin failed: 404' });
    expect(await run('pinterest_board', { url: 'https://www.pinterest.com/a/b/' })).toEqual({ ok: true, pins: [] });
    expect(board).toHaveBeenCalledWith('https://www.pinterest.com/a/b/', 25);
    expect(spent()).toBeCloseTo(0.004);
    expect(WEB_TOOLS).toEqual(expect.arrayContaining(['pinterest_search', 'pinterest_pin', 'pinterest_board']));
  });

  it('social_search finds clips on the platform asked and spends their cost', async () => {
    const clips = [{ platform: SocialPlatform.TikTok, id: '1', url: 'https://www.tiktok.com/@a/video/1', caption: 'c', thumbnail: 'https://t.example/1.jpg', video: 'https://v.example/1.mp4', author: 'a', views: 10, likes: 1, seconds: 12, publishedAt: null }];
    const search = vi.fn(async () => ({ ok: true as const, clips, requests: 1, costUsd: 0.002 }));
    const { run, spent } = setup({ social: { search, profile: vi.fn(), post: vi.fn() } });

    expect(await run('social_search', { platform: 'tiktok', query: 'motion design', limit: 5 })).toEqual({ ok: true, clips });
    expect(search).toHaveBeenCalledWith(SocialPlatform.TikTok, 'motion design', 5);
    expect(spent()).toBeCloseTo(0.002);
    expect(REFERENCE_TOOLS.has('social_search')).toBe(true);
  });

  it('social_profile reads the latest posts of an account, social_post one post by url', async () => {
    const item = { platform: 'instagram' as const, id: '1', url: 'https://www.instagram.com/p/1/', kind: ItemKind.Image, caption: null, images: ['https://cdn.example/a.jpg'], video: null, seconds: null, publishedAt: null, likes: 1, comments: 0, views: null };
    const profile = vi.fn(async () => ({ ok: true as const, items: [item], costUsd: 0.002 }));
    const post = vi.fn(async () => ({ ok: false as const, error: 'post not found', costUsd: 0.002 }));
    const { run, spent } = setup({ social: { search: vi.fn(), profile, post } });

    expect(await run('social_profile', { platform: 'instagram', handle: '@studio', limit: 9 })).toEqual({ ok: true, items: [item] });
    expect(profile).toHaveBeenCalledWith('instagram', '@studio', 9);
    expect(await run('social_post', { url: 'https://www.instagram.com/p/2/' })).toEqual({ ok: false, error: 'post not found' });
    expect(spent()).toBeCloseTo(0.004);
  });

  it('every social tool shares one cap per turn', async () => {
    const empty = vi.fn(async () => ({ ok: true as const, items: [], clips: [], requests: 1, costUsd: 0 }));
    const frames = vi.fn(async () => ({ images: [], parts: [] }));
    const { run } = setup({ social: { search: empty, profile: empty, post: empty }, frames });

    for (let i = 0; i < MAX_SOCIAL_PER_TURN; i++) {
      await run(['social_search', 'social_profile', 'social_post', 'view_video_frames'][i % 4], { platform: 'tiktok', query: 'q', handle: 'h', url: 'https://www.tiktok.com/@a/video/1', video: 'https://v.example/1.mp4' });
    }

    expect(await run('social_profile', { platform: 'tiktok', handle: 'h' })).toMatchObject({ ok: false, error: expect.stringContaining('limit') });
    expect(await run('view_video_frames', { video: 'https://v.example/1.mp4' })).toMatchObject({ ok: false });
  });

  it('view_video_frames shows the cover and frames as images and is a reference', async () => {
    const frames = vi.fn(async () => ({ images: [{ url: 'https://c.example/c.jpg', path: 'p/cover.jpg', width: 10, height: 10 }], parts: [{ mediaType: 'image/jpeg', data: 'AAAA' }] }));
    const { run, tools } = setup({ frames });

    expect(await run('view_video_frames', { video: 'https://v.example/1.mp4', cover: 'https://c.example/c.jpg' }, 'f1')).toMatchObject({ ok: true, images: [{ path: 'p/cover.jpg' }] });
    expect(frames).toHaveBeenCalledWith({ video: 'https://v.example/1.mp4', cover: 'https://c.example/c.jpg' }, 'f1');
    const out = (tools.view_video_frames as unknown as { toModelOutput: (o: unknown) => { type: string } }).toModelOutput({ toolCallId: 'f1', output: {} });
    expect(out.type).toBe('content');
    expect(REFERENCE_TOOLS.has('view_video_frames')).toBe(true);
  });

  it('the guidance walks "in the style of @x" through look, pick and recorded look, for style only', () => {
    for (const step of ['social_profile', 'view_video_frames', 'ask_reference_pick', 'set_reference_look', 'pacing', 'never present', 'uncensored']) {
      expect(WEB_GUIDANCE).toContain(step);
    }
  });

  it('social tools are absent without their ports', () => {
    const { tools } = setup();
    expect([tools.social_search, tools.social_profile, tools.social_post, tools.view_video_frames]).toEqual([undefined, undefined, undefined, undefined]);
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

describe('ask_reference_pick', () => {
  const candidates = Array.from({ length: 4 }, (_, i) => ({ id: `pin${i}`, image: `https://i.pinimg.com/${i}.jpg`, title: `Pin ${i}` }));

  it('hands the candidates to the chat card, free, and caps the pick at the candidates', async () => {
    const { run, spent } = setup({ view: vi.fn(async () => ({ images: [], parts: [] })) as never });
    expect(WEB_TOOLS).toContain('ask_reference_pick');
    expect(await run('ask_reference_pick', { question: 'Which look is yours?', candidates, max: 9 })).toEqual({ ok: true, question: 'Which look is yours?', candidates, min: 1, max: 4 });
    expect(spent()).toBe(0);
  });

  it('a candidate the agent looked at carries its stored copy, because social CDNs refuse to be shown elsewhere', async () => {
    const view = vi.fn(async () => ({ images: [{ url: 'https://scontent.cdninstagram.com/a.jpg', path: 'o/p/web-views/v1/0.jpg', width: 10, height: 10 }], parts: [] }));
    const frames = vi.fn(async () => ({ images: [{ url: 'https://p16.tiktokcdn.com/c.jpg', path: 'o/p/web-views/f1/cover.jpg', width: 10, height: 10 }], parts: [] }));
    const { run } = setup({ view, frames });
    await run('view_images', { urls: ['https://scontent.cdninstagram.com/a.jpg'] }, 'v1');
    await run('view_video_frames', { cover: 'https://p16.tiktokcdn.com/c.jpg' }, 'f1');

    const out = await run('ask_reference_pick', { question: 'Which?', candidates: [{ id: 'a', image: 'https://scontent.cdninstagram.com/a.jpg' }, { id: 'b', image: 'https://p16.tiktokcdn.com/c.jpg' }, { id: 'c', image: 'https://i.pinimg.com/c.jpg', preview: 'x/y/web-views/z/0.jpg' }] });

    expect(out.candidates).toEqual([
      { id: 'a', image: 'https://scontent.cdninstagram.com/a.jpg', preview: 'o/p/web-views/v1/0.jpg' },
      { id: 'b', image: 'https://p16.tiktokcdn.com/c.jpg', preview: 'o/p/web-views/f1/cover.jpg' },
      { id: 'c', image: 'https://i.pinimg.com/c.jpg' }
    ]);
  });

  it('finds the stored copy even when the agent copies a signed url with a different query', async () => {
    const view = vi.fn(async () => ({ images: [{ url: 'https://scontent.cdninstagram.com/v/a.jpg?stp=dst&_nc_ohc=x1&oe=1', path: 'o/p/web-views/v1/0.jpg', width: 10, height: 10 }], parts: [] }));
    const { run } = setup({ view });
    await run('view_images', { urls: ['https://scontent.cdninstagram.com/v/a.jpg?stp=dst&_nc_ohc=x1&oe=1'] }, 'v1');

    const out = await run('ask_reference_pick', { question: 'Which?', candidates: [{ id: 'a', image: 'https://scontent.cdninstagram.com/v/a.jpg?stp=dst&amp;_nc_ohc=x1' }, { id: 'b', image: 'https://i.pinimg.com/b.jpg' }] });

    expect((out.candidates as { preview?: string }[])[0].preview).toBe('o/p/web-views/v1/0.jpg');
  });

  it('stores the candidates the agent never looked at, so the grid never shows a broken picture', async () => {
    const view = vi.fn(async (urls: string[]) => ({ images: urls.map((url, i) => (url.includes('refused') ? { url, error: 'people' } : { url, path: `o/p/web-views/k1/${i}.jpg`, width: 1, height: 1 })), parts: [] }));
    const { run } = setup({ view });

    const out = await run('ask_reference_pick', { question: 'Which?', candidates: [{ id: 'a', image: 'https://scontent.cdninstagram.com/a.jpg' }, { id: 'b', image: 'https://scontent.cdninstagram.com/refused.jpg' }, { id: 'c', image: 'https://i.pinimg.com/c.jpg' }] }, 'k1');

    expect(view).toHaveBeenCalledWith(['https://scontent.cdninstagram.com/a.jpg', 'https://scontent.cdninstagram.com/refused.jpg', 'https://i.pinimg.com/c.jpg'], ViewDetail.Low, 'k1');
    expect(out.candidates).toEqual([
      { id: 'a', image: 'https://scontent.cdninstagram.com/a.jpg', preview: 'o/p/web-views/k1/0.jpg' },
      { id: 'c', image: 'https://i.pinimg.com/c.jpg', preview: 'o/p/web-views/k1/2.jpg' }
    ]);
  });

  it('a new search after a rejection never shows pins the user already saw', async () => {
    const pin = (id: string) => ({ id, url: `https://www.pinterest.com/pin/${id}/`, title: id, description: null, image: { url: `https://i.pinimg.com/${id}.jpg`, width: 10, height: 10 }, colour: null, link: null, pinner: 'p', board: null });
    const search = vi.fn(async () => ({ ok: true as const, pins: [pin('a'), pin('b'), pin('c')], requests: 1, costUsd: 0 }));
    const { run } = setup({ pinterest: { search, pin: vi.fn(), board: vi.fn() }, shown: new Set(['a', 'https://i.pinimg.com/b.jpg']) });

    const out = await run('pinterest_search', { query: 'warm light' });
    expect((out.pins as { id: string }[]).map((p) => p.id)).toEqual(['c']);
  });

  it('a new card never repeats a picture the user already saw', async () => {
    const view = vi.fn(async () => ({ images: [], parts: [] })) as never;
    const { run } = setup({ view, shown: new Set(['pin0', 'https://i.pinimg.com/1.jpg']) });

    const out = await run('ask_reference_pick', { question: 'Which?', candidates });
    expect((out.candidates as { id: string }[]).map((c) => c.id)).toEqual(['pin2', 'pin3']);
  });

  it('asks once per turn, and stops asking after the user rejected too many rounds in a row', async () => {
    const view = vi.fn(async () => ({ images: [], parts: [] })) as never;
    const { run } = setup({ view });
    expect(await run('ask_reference_pick', { question: 'Which?', candidates })).toMatchObject({ ok: true });
    expect(await run('ask_reference_pick', { question: 'Which?', candidates })).toMatchObject({ ok: false });

    const tired = setup({ view, rejections: MAX_REJECTED_ROUNDS });
    expect(await tired.run('ask_reference_pick', { question: 'Which?', candidates })).toMatchObject({ ok: false, error: expect.stringMatching(/choose/) });
  });

  it('a picture the user avoided is never looked at again nor imported', async () => {
    const view = vi.fn(async (urls: string[]) => ({ images: urls.map((url) => ({ url })), parts: [] }));
    const importImage = vi.fn(async () => ({ ok: true as const, assetId: 'a1', width: 1, height: 1 }));
    const { run } = setup({ avoid: new Set(['https://i.pinimg.com/3.jpg']), view: view as never, importImage });

    expect(await run('import_image', { url: 'https://i.pinimg.com/3.jpg' })).toMatchObject({ ok: false });
    expect(importImage).not.toHaveBeenCalled();

    await run('view_images', { urls: ['https://i.pinimg.com/0.jpg', 'https://i.pinimg.com/3.jpg'] });
    expect(view.mock.calls[0][0]).toEqual(['https://i.pinimg.com/0.jpg']);
  });
});

