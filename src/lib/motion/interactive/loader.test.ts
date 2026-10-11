// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hostMain } from './host';
import { HostKind, ScrubSource, embedSnippet, loaderConfig, loaderMain } from './loader';

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

  it('loads an offscreen embed only as it nears the viewport', async () => {
    const frame = await load(`<feega-motion src="${ID}"></feega-motion>`);
    expect(frame.getAttribute('loading')).toBe('lazy');
  });

  it('starts the video before its settings arrive', () => {
    window.fetch = vi.fn(() => new Promise<Response>(() => {})) as never;
    document.body.innerHTML = `<feega-motion src="${ID}"></feega-motion>`;
    loaderMain(window, loaderConfig(ORIGIN), hostMain);

    expect(document.querySelector('feega-motion iframe')).not.toBeNull();
  });

  it('opens the connection to feega before the iframe asks for it', async () => {
    await load(`<feega-motion src="${ID}"></feega-motion>`);
    const hint = document.head.querySelector('link[rel="preconnect"]') as HTMLLinkElement;

    expect(hint.href).toBe(`${ORIGIN}/`);
    expect(document.head.querySelectorAll('link[rel="preconnect"]')).toHaveLength(1);
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

describe('the element in its box', () => {
  beforeEach(() => serve({ width: 1920, height: 1080, playback: 'scrub', scrollLength: 3 }));

  it('fills its parent box unless the page styles it', async () => {
    serve({ width: 1920, height: 1080, playback: 'autoplay', scrollLength: 3 });
    await load(`<div style="width:400px;height:700px"><feega-motion src="${ID}"></feega-motion></div>`);
    const style = getComputedStyle(document.querySelector('feega-motion') as HTMLElement);

    expect(style.display).toBe('block');
    expect(style.width).toBe('100%');
    expect(style.height).toBe('100%');
  });

  it('takes the whole document when it is all the document holds', async () => {
    await load(`<script></script><feega-motion src="${ID}"></feega-motion>`);

    expect(document.documentElement.style.height).toBe('100%');
    expect(document.body.style.margin).toBe('0px');
    expect(document.body.style.height).toBe('100%');
  });

  it('leaves the document of a real site alone', async () => {
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
    await load(`<h1>shop</h1><feega-motion src="${ID}"></feega-motion>`);

    expect(document.documentElement.style.height).toBe('');
    expect(document.body.style.margin).toBe('');
  });
});

describe('the scroll source of a scrub embed', () => {
  const posted: unknown[] = [];

  function framed(sameOrigin: boolean) {
    const outer = document.createElement('iframe');
    outer.style.height = '600px';
    document.body.replaceChildren(outer);
    const child = outer.contentWindow as Window & typeof globalThis;
    if (!sameOrigin) {
      Object.defineProperty(child, 'frameElement', { get: () => null });
    }
    child.fetch = window.fetch;
    child.document.body.innerHTML = `<feega-motion src="${ID}"></feega-motion>`;
    return { outer, child };
  }

  async function mountIn(child: Window) {
    loaderMain(child, loaderConfig(ORIGIN), hostMain);
    await settle();
    const frame = child.document.querySelector('feega-motion iframe') as HTMLIFrameElement;
    posted.length = 0;
    vi.spyOn(frame.contentWindow as Window, 'postMessage').mockImplementation((m: unknown) => void posted.push(m));
    return frame;
  }

  beforeEach(() => serve({ width: 1920, height: 1080, playback: 'scrub', scrollLength: 3 }));

  it('is decided by one table: story on a page, parent scroll in a same-origin frame, gestures in a foreign one', () => {
    expect(loaderConfig(ORIGIN).sources).toEqual({
      [HostKind.Page]: ScrubSource.Story,
      [HostKind.SameOriginFrame]: ScrubSource.ParentScroll,
      [HostKind.ForeignFrame]: ScrubSource.Gesture
    });
  });

  it('builds no tall section inside a frame that cannot scroll', async () => {
    const { child } = framed(true);
    await mountIn(child);
    const el = child.document.querySelector('feega-motion') as HTMLElement;

    expect(child.document.querySelector('[data-scroll]')).toBeNull();
    expect(el.style.height).not.toBe('100vh');
    expect(el.style.position).not.toBe('sticky');
  });

  it('scrubs by the parent page scroll when the parent is reachable', async () => {
    const { outer, child } = framed(true);
    const frame = await mountIn(child);
    outer.getBoundingClientRect = () => ({ top: 0, bottom: 600, height: 600 }) as DOMRect;

    window.dispatchEvent(new Event('scroll'));

    expect(posted.at(-1)).toMatchObject({ type: 'feega:host', progress: expect.any(Number), visible: true });
    expect(frame.parentElement?.tagName).toBe('FEEGA-MOTION');
  });

  it('hands the scrub to the viewer gestures when the parent is foreign', async () => {
    const { child } = framed(false);
    const frame = await mountIn(child);

    frame.dispatchEvent(new Event('load'));

    expect(posted).toEqual([{ type: 'feega:host', gesture: true }]);
    expect(child.document.querySelector('[data-scroll]')).toBeNull();
  });
});

describe('the hosted snippet', () => {
  it('is one loader and one element', () => {
    expect(embedSnippet(ORIGIN, ID)).toBe(`<script src="${ORIGIN}/embed.js" async></script>\n<feega-motion src="${ID}"></feega-motion>`);
  });
});
