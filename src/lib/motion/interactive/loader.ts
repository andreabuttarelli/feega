import { EMBED_ROUTE, HOST_MESSAGE, type hostMain } from './host';
import { PlayMode, SCROLL_LENGTH } from './settings';

export const EMBED_TAG = 'feega-motion';
export const EMBED_ATTR = 'data-feega';
export const LOADER_FILE = 'embed.js';

export enum HostKind {
  Page = 'page',
  SameOriginFrame = 'same-origin-frame',
  ForeignFrame = 'foreign-frame'
}

export enum ScrubSource {
  Story = 'story',
  ParentScroll = 'parent-scroll',
  Gesture = 'gesture'
}

export const SCRUB_SOURCE: Record<HostKind, ScrubSource> = {
  [HostKind.Page]: ScrubSource.Story,
  [HostKind.SameOriginFrame]: ScrubSource.ParentScroll,
  [HostKind.ForeignFrame]: ScrubSource.Gesture
};

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
  kinds: Record<keyof typeof HostKind, HostKind>;
  sources: Record<HostKind, ScrubSource>;
  sourceNames: Record<keyof typeof ScrubSource, ScrubSource>;
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
    fallback: { width: 16, height: 9, playback: PlayMode.Autoplay, scrollLength: SCROLL_LENGTH.default },
    kinds: { ...HostKind },
    sources: SCRUB_SOURCE,
    sourceNames: { ...ScrubSource }
  };
}

export function loaderMain(win: Window, cfg: LoaderConfig, host: typeof hostMain): void {
  const doc = win.document;
  const kind = win === win.top ? cfg.kinds.Page : win.frameElement ? cfg.kinds.SameOriginFrame : cfg.kinds.ForeignFrame;
  const fill = doc.createElement('style');
  fill.textContent = `${cfg.tag},[${cfg.attr}]{display:block;width:100%;height:100%}`;
  doc.head.prepend(fill);

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

  const soleContent = (el: HTMLElement) => el.parentElement === doc.body && Array.from(doc.body.children).every((c) => c === el || c.tagName === 'SCRIPT' || c.tagName === 'STYLE');

  const takeDocument = () => {
    doc.documentElement.style.height = '100%';
    doc.body.style.margin = '0';
    doc.body.style.height = '100%';
  };

  const watchSelf = (frame: HTMLIFrameElement) => host(frame, cfg.hostMessage, win);

  const scrubBy: Record<string, (el: HTMLElement, frame: HTMLIFrameElement, settings: EmbedSettings) => void> = {
    [cfg.sourceNames.Story]: (el, frame, settings) => {
      story(el, settings.scrollLength);
      watchSelf(frame);
    },
    [cfg.sourceNames.ParentScroll]: (_el, frame) => host(frame, cfg.hostMessage, win.parent, win.frameElement as Element),
    [cfg.sourceNames.Gesture]: (_el, frame) => frame.addEventListener('load', () => frame.contentWindow?.postMessage({ type: cfg.hostMessage, gesture: true }, '*'))
  };

  const mount = async (el: HTMLElement) => {
    const id = el.getAttribute('src') ?? el.getAttribute(cfg.attr);
    if (!id || el.hasAttribute(cfg.mounted)) {
      return;
    }
    el.setAttribute(cfg.mounted, '');

    if (soleContent(el)) {
      takeDocument();
    }
    if (win.getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
    }

    const settings = await settingsOf(id);
    const source = settings.playback === cfg.scrub ? cfg.sources[kind] : null;
    const frame = frameOf(id, el.getAttribute('fit'));
    el.appendChild(frame);

    if (el.clientHeight === 0 && !el.style.height) {
      if (source === cfg.sourceNames.Story) {
        el.style.height = '100vh';
      } else {
        el.style.aspectRatio = `${settings.width} / ${settings.height}`;
      }
    }
    if (source) {
      scrubBy[source](el, frame, settings);
      return;
    }
    watchSelf(frame);
  };

  const scan = () => doc.querySelectorAll<HTMLElement>(`${cfg.tag},[${cfg.attr}]`).forEach(mount);

  scan();
  doc.addEventListener('DOMContentLoaded', scan);
  new (win as typeof globalThis).MutationObserver(scan).observe(doc.documentElement, { childList: true, subtree: true });
}
