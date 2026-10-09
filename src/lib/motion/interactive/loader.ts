import { EMBED_ROUTE, HOST_MESSAGE, type hostMain } from './host';
import { PlayMode, SCROLL_LENGTH } from './settings';

export const EMBED_TAG = 'feega-motion';
export const EMBED_ATTR = 'data-feega';
export const LOADER_FILE = 'embed.js';

export type EmbedSettings = { width: number; height: number; playback: string; scrollLength: number };

export type LoaderConfig = {
  origin: string;
  route: string;
  tag: string;
  attr: string;
  mounted: string;
  hostMessage: string;
  scrub: string;
  fallback: EmbedSettings;
};

export const embedSnippet = (origin: string, id: string) => `<script src="${origin}/${LOADER_FILE}" async></script>\n<${EMBED_TAG} src="${id}"></${EMBED_TAG}>`;

export function snippetOf(embedUrl: string): string {
  const url = new URL(embedUrl);
  return embedSnippet(url.origin, url.pathname.slice(url.pathname.lastIndexOf('/') + 1));
}

export function loaderConfig(origin: string): LoaderConfig {
  return {
    origin,
    route: EMBED_ROUTE,
    tag: EMBED_TAG,
    attr: EMBED_ATTR,
    mounted: 'data-feega-mounted',
    hostMessage: HOST_MESSAGE,
    scrub: PlayMode.Scrub,
    fallback: { width: 16, height: 9, playback: PlayMode.Autoplay, scrollLength: SCROLL_LENGTH.default }
  };
}

export function loaderMain(win: Window, cfg: LoaderConfig, host: typeof hostMain): void {
  const doc = win.document;

  const settingsOf = (id: string): Promise<EmbedSettings> =>
    win
      .fetch(`${cfg.origin}${cfg.route}/${id}.json`)
      .then((r) => (r.ok ? r.json() : cfg.fallback))
      .catch(() => cfg.fallback);

  const frameOf = (id: string, fit: string | null) => {
    const frame = doc.createElement('iframe');
    frame.src = `${cfg.origin}${cfg.route}/${encodeURIComponent(id)}${fit ? `?fit=${encodeURIComponent(fit)}` : ''}`;
    frame.title = 'Interactive video';
    frame.allow = 'accelerometer; gyroscope';
    frame.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block');
    return frame;
  };

  const story = (el: HTMLElement, viewports: number) => {
    const section = doc.createElement('div');
    section.setAttribute('data-scroll', String(viewports));
    el.parentNode?.insertBefore(section, el);
    section.appendChild(el);
    el.style.position = 'sticky';
    el.style.top = '0';
  };

  const mount = async (el: HTMLElement) => {
    const id = el.getAttribute('src') ?? el.getAttribute(cfg.attr);
    if (!id || el.hasAttribute(cfg.mounted)) {
      return;
    }
    el.setAttribute(cfg.mounted, '');

    const style = win.getComputedStyle(el);
    if (style.display === 'inline') {
      el.style.display = 'block';
    }
    if (style.position === 'static') {
      el.style.position = 'relative';
    }

    const settings = await settingsOf(id);
    const scrub = settings.playback === cfg.scrub;
    const frame = frameOf(id, el.getAttribute('fit'));
    el.appendChild(frame);

    if (el.clientHeight === 0 && !el.style.height) {
      if (scrub) {
        el.style.height = '100vh';
      } else {
        el.style.aspectRatio = `${settings.width} / ${settings.height}`;
      }
    }
    if (scrub) {
      story(el, settings.scrollLength);
    }
    host(frame, cfg.hostMessage, win);
  };

  const scan = () => doc.querySelectorAll<HTMLElement>(`${cfg.tag},[${cfg.attr}]`).forEach(mount);

  scan();
  doc.addEventListener('DOMContentLoaded', scan);
  new (win as typeof globalThis).MutationObserver(scan).observe(doc.documentElement, { childList: true, subtree: true });
}
