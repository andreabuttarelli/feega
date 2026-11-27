import { describe, expect, it } from 'vitest';
import { CDN_HOSTS, OFFLINE_NOTE, cdnUrls, iconFetcher, innerOf } from './cdn';

const SOURCE = { name: 'lucide-static', version: '1.82.0' };
const SVG = '<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>';

type Reply = { status: number; text: string } | Error;

function network(replies: Record<string, Reply>) {
  const requests: string[] = [];
  const fetch = async (url: string) => {
    requests.push(url);
    const reply = replies[new URL(url).hostname] ?? new Error('unreachable');
    if (reply instanceof Error) {
      throw reply;
    }
    return reply;
  };
  return { fetch, requests };
}

describe('cdn addresses', () => {
  it('pins the exact version and tries jsDelivr before unpkg', () => {
    expect(cdnUrls(SOURCE, 'icons/camera.svg')).toEqual(['https://cdn.jsdelivr.net/npm/lucide-static@1.82.0/icons/camera.svg', 'https://unpkg.com/lucide-static@1.82.0/icons/camera.svg']);
  });

  it('keeps a scoped package name whole', () => {
    expect(cdnUrls({ name: '@phosphor-icons/core', version: '2.1.1' }, 'assets/bold/camera-bold.svg')[0]).toBe('https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/bold/camera-bold.svg');
  });

  it('names the two hosts a plugin has to declare', () => {
    expect(CDN_HOSTS).toEqual(['cdn.jsdelivr.net', 'unpkg.com']);
  });
});

describe('icon fetcher', () => {
  it('fetches an icon once and serves it from memory afterwards', async () => {
    const net = network({ 'cdn.jsdelivr.net': { status: 200, text: SVG } });
    const fetcher = iconFetcher(net.fetch, SOURCE);

    expect(fetcher.cached('icons/camera.svg')).toBeUndefined();
    expect(await fetcher.get('icons/camera.svg')).toBe(SVG);
    expect(await fetcher.get('icons/camera.svg')).toBe(SVG);
    expect(fetcher.cached('icons/camera.svg')).toBe(SVG);
    expect(net.requests).toHaveLength(1);
  });

  it('asks once when the same icon is wanted twice at the same time', async () => {
    const net = network({ 'cdn.jsdelivr.net': { status: 200, text: SVG } });
    const fetcher = iconFetcher(net.fetch, SOURCE);
    await Promise.all([fetcher.get('icons/camera.svg'), fetcher.get('icons/camera.svg')]);

    expect(net.requests).toHaveLength(1);
  });

  it('falls back to unpkg when jsDelivr is down', async () => {
    const net = network({ 'cdn.jsdelivr.net': new Error('down'), 'unpkg.com': { status: 200, text: SVG } });
    const fetcher = iconFetcher(net.fetch, SOURCE);

    expect(await fetcher.get('icons/camera.svg')).toBe(SVG);
    expect(net.requests.map((url) => new URL(url).hostname)).toEqual(['cdn.jsdelivr.net', 'unpkg.com']);
  });

  it('falls back when the first host answers with an error page', async () => {
    const net = network({ 'cdn.jsdelivr.net': { status: 200, text: '<html>nope</html>' }, 'unpkg.com': { status: 200, text: SVG } });

    expect(await iconFetcher(net.fetch, SOURCE).get('icons/camera.svg')).toBe(SVG);
  });

  it('gives null when both hosts fail, and asks again next time', async () => {
    const replies: Record<string, Reply> = { 'cdn.jsdelivr.net': new Error('offline'), 'unpkg.com': { status: 404, text: 'Not found' } };
    const net = network(replies);
    const fetcher = iconFetcher(net.fetch, SOURCE);

    expect(await fetcher.get('icons/camera.svg')).toBeNull();
    expect(fetcher.cached('icons/camera.svg')).toBeUndefined();

    replies['cdn.jsdelivr.net'] = { status: 200, text: SVG };

    expect(await fetcher.get('icons/camera.svg')).toBe(SVG);
  });

  it('says what to do offline', () => {
    expect(OFFLINE_NOTE).toBe('Icons need internet the first time.');
  });
});

describe('inner markup of an svg file', () => {
  it('drops the licence comment and the svg tag and joins the lines', () => {
    const file = '<!-- @license lucide-static v1.82.0 - ISC -->\n<svg\n  class="x"\n  viewBox="0 0 24 24"\n>\n  <path d="M1 1" />\n  <circle cx="1" cy="1" r="1" />\n</svg>\n';

    expect(innerOf(file)).toBe('<path d="M1 1" /><circle cx="1" cy="1" r="1" />');
  });

  it('keeps a title', () => {
    expect(innerOf('<svg role="img"><title>1&amp;1</title><path d="M1"/></svg>')).toBe('<title>1&amp;1</title><path d="M1"/>');
  });
});
