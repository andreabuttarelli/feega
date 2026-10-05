import type { BrandTokens } from '../brand';
import type { AudioAnalysis } from '../audio-analysis';
import type { MotionDoc } from '../doc';
import { HYPERFRAMES_VERSION, composeHtml } from '../hyperframes/compose';
import { esc } from '../hyperframes/html';
import { InputKey } from '../expression/inputs';
import { INPUT_MESSAGE } from './runtime';
import { playerMain, type PlayerConfig } from './player';
import { Liveness, PlayMode, interactiveOf, type Interactive } from './settings';

export const HOST_MESSAGE = 'feega:host';
export const PLAYER_URL = `https://cdn.jsdelivr.net/npm/@hyperframes/player@${HYPERFRAMES_VERSION}/dist/hyperframes-player.global.js`;
export const BUNDLE_FILE = 'feega-interactive.html';

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

function playerConfig(html: string, doc: MotionDoc, settings: Interactive): PlayerConfig {
  return {
    html,
    width: doc.width,
    height: doc.height,
    duration: doc.durationInFrames / doc.fps,
    playback: settings.playback,
    loop: settings.loop,
    modes: { autoplay: PlayMode.Autoplay, inView: PlayMode.InView, scrub: PlayMode.Scrub },
    inputMessage: INPUT_MESSAGE,
    hostMessage: HOST_MESSAGE,
    keys: { x: InputKey.PointerX, y: InputKey.PointerY, down: InputKey.PointerDown, hover: InputKey.Hover, tiltX: InputKey.TiltX, tiltY: InputKey.TiltY, scroll: InputKey.Scroll, time: InputKey.Time }
  };
}

export function playerPage(html: string, doc: MotionDoc, settings: Interactive, title: string): string {
  return [
    '<!doctype html><html lang="en"><head><meta charset="UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${esc(title)}</title>`,
    `<script src="${PLAYER_URL}"></script>`,
    '<style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}#stage{position:relative;width:100%;height:100%}#player,#pad{position:absolute;inset:0;width:100%;height:100%}#pad{touch-action:none}</style>',
    '</head><body><div id="stage">',
    '<hyperframes-player id="player" sandbox-origin="opaque" assets-loading-ui="none" disable-click-to-play></hyperframes-player>',
    '<div id="pad"></div></div>',
    `<script>(${playerMain.toString()})(${scriptJson(playerConfig(html, doc, settings))});</script>`,
    '</body></html>'
  ].join('');
}

export function embedSnippet(doc: MotionDoc, file = BUNDLE_FILE): string {
  const frame = `<iframe src="${esc(file)}" title="Interactive video" style="width:100%;aspect-ratio:${doc.width}/${doc.height};border:0;display:block" allow="accelerometer; gyroscope" loading="lazy"></iframe>`;
  const host = `<script>(function(f){function s(){var d=document.documentElement,m=Math.max(1,d.scrollHeight-innerHeight),r=f.getBoundingClientRect();f.contentWindow&&f.contentWindow.postMessage({type:"${HOST_MESSAGE}",scroll:Math.min(1,Math.max(0,scrollY/m)),visible:r.bottom>0&&r.top<innerHeight},"*")}addEventListener("scroll",s,{passive:true});addEventListener("resize",s);f.addEventListener("load",s)})(document.currentScript.previousElementSibling);</script>`;
  return `${frame}\n${host}`;
}

export async function interactiveBundle(input: InteractiveInput): Promise<InteractiveBundle> {
  const settings = input.settings ?? interactiveOf(input.doc);
  const logo = input.tokens.logoUrl ? await inlineAssets({ logo: input.tokens.logoUrl }, input.fetchBlob) : {};
  const assets = await inlineAssets(input.assetUrls, input.fetchBlob);
  const tokens = { ...input.tokens, logoUrl: logo.logo ?? input.tokens.logoUrl };
  const composed = composeHtml({ doc: input.doc, tokens, assets, analyses: input.analyses, liveness: Liveness.Live });
  const html = playerPage(composed, input.doc, settings, input.title);
  return { html, bytes: new TextEncoder().encode(html).length, snippet: embedSnippet(input.doc) };
}
