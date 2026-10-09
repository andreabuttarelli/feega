import type { BrandTokens } from '../brand';
import type { AudioAnalysis } from '../audio-analysis';
import type { MotionDoc } from '../doc';
import { HYPERFRAMES_VERSION, Target, composeHtml } from '../hyperframes/compose';
import { esc } from '../hyperframes/html';
import { InputKey } from '../expression/inputs';
import { INPUT_MESSAGE } from './runtime';
import { EVENT_MESSAGE } from '../custom/runtime';
import { playerMain, type PlayerConfig } from './player';
import { hostMain, readHost, selfScroll } from './host';
import { Liveness, PlayMode, interactiveOf, type Interactive } from './settings';

export const HOST_MESSAGE = 'feega:host';
export const PLAYER_URL = `https://cdn.jsdelivr.net/npm/@hyperframes/player@${HYPERFRAMES_VERSION}/dist/hyperframes-player.global.js`;
export const BUNDLE_FILE = 'feega-interactive.html';
export const EMBED_ROUTE = '/e';
export const SELF_SCROLL = 'self-scroll';
export const STANDALONE_MS = 500;
const SELF_SCROLL_VIEWPORTS = 4;

export const embedUrl = (origin: string, id: string) => `${origin}${EMBED_ROUTE}/${id}`;

export type FetchBlob = (url: string) => Promise<Blob>;

export type InteractiveInput = {
  doc: MotionDoc;
  tokens: BrandTokens;
  assetUrls: Record<string, string>;
  analyses?: Record<string, AudioAnalysis>;
  settings?: Interactive;
  title: string;
  fetchBlob: FetchBlob;
};

export type InteractiveBundle = { html: string; bytes: number; snippet: string };

async function dataUri(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

export async function inlineAssets(urls: Record<string, string>, fetchBlob: FetchBlob): Promise<Record<string, string>> {
  const entries = await Promise.all(Object.entries(urls).map(async ([id, url]) => [id, url.startsWith('data:') ? url : await dataUri(await fetchBlob(url))] as const));
  return Object.fromEntries(entries);
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

type PlayerSource = Pick<PlayerConfig, 'html' | 'width' | 'height' | 'duration' | 'playback' | 'loop'>;

const PLAYER_START = '<script>(function playerMain';
const TITLE = /<title>([^<]*)<\/title>/;

function playerConfig(source: PlayerSource): PlayerConfig {
  return {
    ...source,
    modes: { autoplay: PlayMode.Autoplay, inView: PlayMode.InView, scrub: PlayMode.Scrub },
    inputMessage: INPUT_MESSAGE,
    eventMessage: EVENT_MESSAGE,
    hostMessage: HOST_MESSAGE,
    selfScroll: SELF_SCROLL,
    standaloneMs: STANDALONE_MS,
    keys: { x: InputKey.PointerX, y: InputKey.PointerY, down: InputKey.PointerDown, hover: InputKey.Hover, tiltX: InputKey.TiltX, tiltY: InputKey.TiltY, scroll: InputKey.Scroll, time: InputKey.Time }
  };
}

const PAD_TOUCH: Record<PlayMode, string> = {
  [PlayMode.Autoplay]: 'none',
  [PlayMode.InView]: 'none',
  [PlayMode.Scrub]: 'pan-y',
  [PlayMode.Paused]: 'none'
};

function sourceOf(html: string, doc: MotionDoc, settings: Interactive): PlayerSource {
  return { html, width: doc.width, height: doc.height, duration: doc.durationInFrames / doc.fps, playback: settings.playback, loop: settings.loop };
}

function jsonEnd(text: string, start: number): number {
  let depth = 0;
  let quoted = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      quoted = c !== '"' || isEscaped(text, i);
      continue;
    }
    if (c === '"') {
      quoted = true;
      continue;
    }
    depth += c === '{' ? 1 : c === '}' ? -1 : 0;
    if (depth === 0) {
      return i + 1;
    }
  }
  return -1;
}

function isEscaped(text: string, at: number): boolean {
  let slashes = 0;
  for (let i = at - 1; text[i] === '\\'; i--) {
    slashes++;
  }
  return slashes % 2 === 1;
}

export function upgradePlayer(page: string): string | null {
  const script = page.indexOf(PLAYER_START);
  const start = script < 0 ? -1 : page.indexOf('({"html":', script) + 1;
  const end = start > 0 ? jsonEnd(page, start) : -1;
  if (end < 0) {
    return null;
  }
  const stored = JSON.parse(page.slice(start, end)) as PlayerSource;
  const title = TITLE.exec(page)?.[1] ?? '';
  const { html, width, height, duration, playback, loop } = stored;
  return pageOf({ html, width, height, duration, playback, loop }, title);
}

export function playerPage(html: string, doc: MotionDoc, settings: Interactive, title: string): string {
  return pageOf(sourceOf(html, doc, settings), esc(title));
}

function pageOf(source: PlayerSource, title: string): string {
  return [
    '<!doctype html><html lang="en"><head><meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${title}</title>`,
    `<script src="${PLAYER_URL}"></script>`,
    `<style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}#stage{position:relative;width:100%;height:100%}#player,#pad{position:absolute;inset:0;width:100%;height:100%}#pad{touch-action:${PAD_TOUCH[source.playback as PlayMode]}}html.${SELF_SCROLL}{overflow-y:auto;height:auto}html.${SELF_SCROLL} body{overflow:visible;height:${SELF_SCROLL_VIEWPORTS * 100}vh}html.${SELF_SCROLL} #stage{position:sticky;top:0;height:100vh}</style>`,
    '</head><body><div id="stage">',
    '<hyperframes-player id="player" sandbox-origin="opaque" assets-loading-ui="none" disable-click-to-play></hyperframes-player>',
    '<div id="pad"></div></div>',
    `<script>(${playerMain.toString()})(${scriptJson(playerConfig(source))},${readHost.toString()},${selfScroll.toString()});</script>`,
    '</body></html>'
  ].join('');
}

type SnippetDoc = Pick<MotionDoc, 'width' | 'height'> & { interactive?: Partial<Interactive> };

const plainSnippet = (embed: string) => embed;
const scrollStory = (embed: string, settings: Interactive) => `<div data-scroll="${settings.scrollLength}">\n${embed}\n</div>`;

const SNIPPET_SHAPE: Record<PlayMode, (embed: string, settings: Interactive) => string> = {
  [PlayMode.Autoplay]: plainSnippet,
  [PlayMode.InView]: plainSnippet,
  [PlayMode.Scrub]: scrollStory,
  [PlayMode.Paused]: plainSnippet
};

export function embedSnippet(doc: SnippetDoc, file = BUNDLE_FILE): string {
  const settings = interactiveOf(doc);
  const frame = `<iframe src="${esc(file)}" title="Interactive video" style="width:100%;aspect-ratio:${doc.width}/${doc.height};border:0;display:block" allow="accelerometer; gyroscope" loading="lazy"></iframe>`;
  const host = `<script>(${hostMain.toString()})(document.currentScript.previousElementSibling,"${HOST_MESSAGE}",window);</script>`;
  return SNIPPET_SHAPE[settings.playback](`${frame}\n${host}`, settings);
}

export async function interactiveBundle(input: InteractiveInput): Promise<InteractiveBundle> {
  const settings = input.settings ?? interactiveOf(input.doc);
  const logo = input.tokens.logoUrl ? await inlineAssets({ logo: input.tokens.logoUrl }, input.fetchBlob) : {};
  const assets = await inlineAssets(input.assetUrls, input.fetchBlob);
  const tokens = { ...input.tokens, logoUrl: logo.logo ?? input.tokens.logoUrl };
  const composed = composeHtml({ doc: input.doc, tokens, assets, analyses: input.analyses, liveness: Liveness.Live, target: Target.Screen });
  const html = playerPage(composed, input.doc, settings, input.title);
  return { html, bytes: new TextEncoder().encode(html).length, snippet: embedSnippet({ ...input.doc, interactive: settings }) };
}
