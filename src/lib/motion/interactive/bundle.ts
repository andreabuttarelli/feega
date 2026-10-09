import type { BrandTokens } from '../brand';
import type { AudioAnalysis } from '../audio-analysis';
import type { MotionDoc } from '../doc';
import { Target, composeHtml, hostedScriptTag, inlinedScript, type Inlined } from '../hyperframes/compose';
import { HOSTED, MODULES, Module, Script, cdnRewrites, defaultOrigin, folderOf, libsBase, moduleUrl, notice, scriptUrl } from '../libs/catalog';
import type { InlinedModules } from '../hyperframes/three';
import { MATTE_RUNTIME } from '../hyperframes/mattes';
import { esc } from '../hyperframes/html';
import { InputKey } from '../expression/inputs';
import { INPUT_MESSAGE } from './runtime';
import { EVENT_MESSAGE } from '../custom/runtime';
import { playerMain, type PlayerConfig } from './player';
import { EMBED_ROUTE, HOST_MESSAGE, gestureScrub, hostMain, readHost, selfScroll } from './host';
import { Liveness, PlayMode, SCROLL_LENGTH, interactiveOf, type Interactive } from './settings';
import { FIT_SCALE, fitBox } from './fit';
import type { EmbedSettings } from './loader';

export const BUNDLE_FILE = 'feega-interactive.html';
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
  origin?: string;
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

type PlayerSource = Pick<PlayerConfig, 'html' | 'width' | 'height' | 'duration' | 'playback' | 'loop'> & { scrollLength?: number };

const PLAYER_CALL = '})({"html":';
const TITLE = /<title>([^<]*)<\/title>/;

function playerConfig(source: PlayerSource): PlayerConfig {
  return {
    ...source,
    scrollLength: source.scrollLength ?? SCROLL_LENGTH.default,
    modes: { autoplay: PlayMode.Autoplay, inView: PlayMode.InView, scrub: PlayMode.Scrub },
    inputMessage: INPUT_MESSAGE,
    eventMessage: EVENT_MESSAGE,
    hostMessage: HOST_MESSAGE,
    selfScroll: SELF_SCROLL,
    standaloneMs: STANDALONE_MS,
    fitScale: FIT_SCALE,
    keys: { x: InputKey.PointerX, y: InputKey.PointerY, down: InputKey.PointerDown, hover: InputKey.Hover, tiltX: InputKey.TiltX, tiltY: InputKey.TiltY, scroll: InputKey.Scroll, time: InputKey.Time }
  };
}

function licences(inlined: Inlined, origin: string): string {
  const lines = (Object.keys(inlined) as Script[]).sort().map((script) => {
    const lib = HOSTED[script];
    return `${lib.name}@${lib.version} (${lib.licence}) ${lib.home} licence: ${libsBase(origin)}/${folderOf(lib)}/${lib.licenceFile}`;
  });
  return `<!--\nThird-party software included unmodified in this file:\n${lines.join('\n')}\n-->`;
}

const HTML_TYPE = /^text\/html/;

async function libraryCode(url: string, name: string, fetchBlob: FetchBlob): Promise<string> {
  const blob = await fetchBlob(url).catch((e: unknown) => {
    throw new Error(`${name} could not be loaded: ${e instanceof Error ? e.message : String(e)}`);
  });
  if (HTML_TYPE.test(blob.type)) {
    throw new Error(`${name} could not be loaded: ${url} answered with a page, not a script`);
  }
  return blob.text();
}

const libName = (lib: { name: string; version: string }) => `${lib.name}@${lib.version}`;

type Need = (html: string, origin: string, script: Script) => boolean;

const tagged: Need = (html, origin, script) => html.includes(`<script src="${scriptUrl(origin, script)}"`);

const SCRIPT_NEED: Partial<Record<Script, Need>> = {
  [Script.Player]: () => true,
  [Script.Screenshot]: (html) => html.includes(MATTE_RUNTIME)
};

const scriptNeeded: Need = (html, origin, script) => (SCRIPT_NEED[script] ?? tagged)(html, origin, script);

async function inlinedScripts(html: string, origin: string, fetchBlob: FetchBlob): Promise<Inlined> {
  const needed = Object.values(Script).filter((script) => scriptNeeded(html, origin, script));
  const codes = await Promise.all(needed.map(async (script) => [script, await libraryCode(scriptUrl(origin, script), libName(HOSTED[script]), fetchBlob)] as const));
  return Object.fromEntries(codes);
}

async function inlinedModules(html: string, origin: string, fetchBlob: FetchBlob): Promise<InlinedModules> {
  const needed = Object.values(Module).filter((module) => html.includes(`"${module}":"${moduleUrl(origin, module)}"`));
  const codes = await Promise.all(needed.map(async (module) => [module, await libraryCode(moduleUrl(origin, module), `${libName(MODULES[module].lib)} (${module})`, fetchBlob)] as const));
  return Object.fromEntries(codes);
}

const PAD_TOUCH: Record<PlayMode, string> = {
  [PlayMode.Autoplay]: 'none',
  [PlayMode.InView]: 'none',
  [PlayMode.Scrub]: 'pan-y',
  [PlayMode.Paused]: 'none'
};

function sourceOf(html: string, doc: MotionDoc, settings: Interactive): PlayerSource {
  return { html, width: doc.width, height: doc.height, duration: doc.durationInFrames / doc.fps, playback: settings.playback, loop: settings.loop, scrollLength: settings.scrollLength };
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

type Stored = { source: PlayerSource; title: string };

function storedPlayer(page: string): Stored | null {
  const call = page.indexOf(PLAYER_CALL);
  const start = call < 0 ? -1 : call + PLAYER_CALL.indexOf('{');
  const end = start > 0 ? jsonEnd(page, start) : -1;
  if (end < 0) {
    return null;
  }
  const { html, width, height, duration, playback, loop, scrollLength } = JSON.parse(page.slice(start, end)) as PlayerSource;
  return { source: { html, width, height, duration, playback, loop, scrollLength }, title: TITLE.exec(page)?.[1] ?? '' };
}

const INLINED_SCRIPT = /<script>\/\*! (.+?) \*\/\n[\s\S]*?<\/script>/g;
const INLINED_MODULE = /"([^"]+)":"data:text\/javascript;base64,[A-Za-z0-9+/=]*"/g;
const SCRIPT_SRC = 'script-src &#39;unsafe-inline&#39;';
const SCRIPT_BY_NOTICE = new Map(Object.values(Script).map((script) => [notice(HOSTED[script]), script]));
const MODULE_NAMES = new Set<string>(Object.values(Module));

function rehosted(html: string, origin: string): string {
  return html
    .replace(INLINED_SCRIPT, (tag, lib: string) => {
      const script = SCRIPT_BY_NOTICE.get(lib);
      return script ? hostedScriptTag(origin, script) : tag;
    })
    .replace(INLINED_MODULE, (entry, name: string) => (MODULE_NAMES.has(name) ? `"${name}":"${moduleUrl(origin, name as Module)}"` : entry))
    .replace(SCRIPT_SRC, `${SCRIPT_SRC} ${libsBase(origin)}/`);
}

const selfHosted = (html: string, origin: string) => rehosted(cdnRewrites(origin).reduce((out, [cdn, ours]) => out.replaceAll(cdn, ours), html), origin);

export function upgradePlayer(page: string, origin: string): string | null {
  const stored = storedPlayer(page);
  return stored ? `<!doctype html>${pageOf({ ...stored.source, html: selfHosted(stored.source.html, origin) }, stored.title, hostedScriptTag(origin, Script.Player))}` : null;
}

export function embedSettings(page: string): EmbedSettings | null {
  const source = storedPlayer(page)?.source;
  return source ? { width: source.width, height: source.height, playback: source.playback, scrollLength: source.scrollLength ?? SCROLL_LENGTH.default } : null;
}

export function playerPage(html: string, doc: MotionDoc, settings: Interactive, title: string, player: string): string {
  return pageOf(sourceOf(html, doc, settings), esc(title), player);
}

function pageOf(source: PlayerSource, title: string, player: string): string {
  return [
    '<html lang="en"><head><meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${title}</title>`,
    player,
    `<style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}#stage{position:relative;width:100%;height:100%;overflow:hidden}#player{position:absolute}#pad{position:absolute;inset:0;width:100%;height:100%}#pad{touch-action:${PAD_TOUCH[source.playback as PlayMode]}}html.${SELF_SCROLL}{overflow-y:auto;height:auto}html.${SELF_SCROLL} body{overflow:visible;height:${SELF_SCROLL_VIEWPORTS * 100}vh}html.${SELF_SCROLL} #stage{position:sticky;top:0;height:100vh}</style>`,
    '</head><body><div id="stage">',
    '<hyperframes-player id="player" sandbox-origin="opaque" assets-loading-ui="none" disable-click-to-play></hyperframes-player>',
    '<div id="pad"></div></div>',
    `<script>(${playerMain.toString()})(${scriptJson(playerConfig(source))},${readHost.toString()},${selfScroll.toString()},${fitBox.toString()},${gestureScrub.toString()});</script>`,
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

export function fileSnippet(doc: SnippetDoc, file = BUNDLE_FILE): string {
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
  const origin = input.origin ?? defaultOrigin();
  const page = { doc: input.doc, tokens, assets, analyses: input.analyses, liveness: Liveness.Live, target: Target.Screen, origin };
  const hosted = composeHtml(page);
  const [{ [Script.Player]: player, ...inlined }, modules] = await Promise.all([inlinedScripts(hosted, origin, input.fetchBlob), inlinedModules(hosted, origin, input.fetchBlob)]);
  const composed = composeHtml({ ...page, inlined, modules });
  const html = `<!doctype html>${licences({ ...inlined, [Script.Player]: player }, origin)}${playerPage(composed, input.doc, settings, input.title, inlinedScript(Script.Player, player ?? ''))}`;
  return { html, bytes: new TextEncoder().encode(html).length, snippet: fileSnippet({ ...input.doc, interactive: settings }) };
}
