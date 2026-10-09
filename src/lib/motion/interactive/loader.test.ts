// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hostMain } from './host';
import { embedSnippet, loaderConfig, loaderMain } from './loader';

const ORIGIN = 'https://oh.feega.app';
const ID = 'c76b6d3b-8262-4b68-ad58-3cb51a6190a9';
const flush = () => new Promise((r) => setTimeout(r, 0));

function serve(settings: Record<string, unknown> | null) {
  const fetch = vi.fn(async () => (settings ? new Response(JSON.stringify(settings)) : new Response('', { status: 404 })));
  window.fetch = fetch as never;
  return fetch;
}

async function settle() {
  await flush();
  await flush();
}

async function load(html: string) {
  document.body.innerHTML = html;
  loaderMain(window, loaderConfig(ORIGIN), hostMain);
  await settle();
  return document.querySelector('iframe') as HTMLIFrameElement;
}

describe('the hosted embed loader', () => {
  beforeEach(() => serve({ width: 1920, height: 1080, playback: 'autoplay', scrollLength: 3 }));

  it('creates an iframe that fills the element', async () => {
    const frame = await load(`<feega-motion src="${ID}" style="width:600px;height:800px"></feega-motion>`);

    expect(frame.src).toBe(`${ORIGIN}/e/${ID}`);
    expect(frame.style.width).toBe('100%');
    expect(frame.style.height).toBe('100%');
    expect(frame.parentElement?.tagName).toBe('FEEGA-MOTION');
  });

  it('reads the video settings from feega, not from the snippet', async () => {
    const fetch = serve({ width: 1080, height: 1920, playback: 'autoplay', scrollLength: 3 });
    await load(`<feega-motion src="${ID}"></feega-motion>`);

    expect(fetch).toHaveBeenCalledWith(`${ORIGIN}/e/${ID}.json`);
    expect((document.querySelector('feega-motion') as HTMLElement).style.aspectRatio).toBe('1080 / 1920');
  });

  it('wraps a scrub video in a sticky scroll story of scrollLength viewports', async () => {
    serve({ width: 1920, height: 1080, playback: 'scrub', scrollLength: 5 });
    await load(`<feega-motion src="${ID}"></feega-motion>`);
    const el = document.querySelector('feega-motion') as HTMLElement;
    const story = el.parentElement as HTMLElement;

    expect(story.getAttribute('data-scroll')).toBe('5');
    expect(story.style.height).toBe('500vh');
    expect(el.style.position).toBe('sticky');
    expect(el.style.height).toBe('100vh');
  });

  it('forwards fit="contain" to the player', async () => {
    const frame = await load(`<feega-motion src="${ID}" fit="contain"></feega-motion>`);
    expect(frame.src).toBe(`${ORIGIN}/e/${ID}?fit=contain`);
  });

  it('mounts a data-feega div for builders that strip unknown tags, once', async () => {
    document.body.innerHTML = `<div data-feega="${ID}"></div>`;
    loaderMain(window, loaderConfig(ORIGIN), hostMain);
    loaderMain(window, loaderConfig(ORIGIN), hostMain);
    await settle();

    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });

  it('mounts an element added after the page loaded', async () => {
    await load('<main></main>');
    document.querySelector('main')!.innerHTML = `<feega-motion src="${ID}"></feega-motion>`;
    await settle();

    expect(document.querySelectorAll('feega-motion iframe')).toHaveLength(1);
  });

  it('leaves an old iframe snippet alone', async () => {
    const frame = await load(`<iframe src="${ORIGIN}/e/${ID}" style="width:100%;aspect-ratio:16/9"></iframe>`);

    expect(frame.parentElement).toBe(document.body);
    expect(document.querySelectorAll('iframe')).toHaveLength(1);
  });
});

describe('the hosted snippet', () => {
  it('is one loader and one element', () => {
    expect(embedSnippet(ORIGIN, ID)).toBe(`<script src="${ORIGIN}/embed.js" async></script>\n<feega-motion src="${ID}"></feega-motion>`);
  });
});
