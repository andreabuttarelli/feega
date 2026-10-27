import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, addTrack, setTrackMatte, type OpResult } from '@feega/motion-core/motion/timeline';
import { TrackKind } from '@feega/motion-core/motion/components';
import { Matte } from '@feega/motion-core/motion/mask';
import { composeHtml } from '@feega/motion-core/motion/hyperframes/compose';
import { LIVE_GLOBAL } from '@feega/motion-core/motion/interactive/runtime';
import { Liveness, PlayMode } from '@feega/motion-core/motion/interactive/settings';
import { InteractivePreset, applyInteractivePreset } from './presets';
import { GPU_PLAYER_ROUTE, SELF_SCROLL, STANDALONE_MS, embedSettings, gpuSource, hostedPage, interactiveBundle, livePage, upgradePlayer } from './bundle';
import { LIVE_MESSAGE } from './live-bridge';
import { HOST_MESSAGE } from './host';
import { MOTION_LIBS_ROUTE } from '@feega/motion-core/motion/libs/catalog';
import { INLINE_CORE_GLOBAL, unzipBase64 } from '@feega/motion-core/motion/gpu-full/inline-core';
import { writeComponent } from '../custom/ops';
import { ComponentMode } from '@feega/motion-core/motion/custom/component';
import { EVENT_MESSAGE } from '@feega/motion-core/motion/custom/runtime';

function ok(result: OpResult): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

const SECRET = 'eyJhbGciOiJIUzI1NiJ9.secret';
const SIGNED = `https://klnswzhhgrqvbfjzioul.supabase.co/storage/v1/object/sign/canvas-assets/a.png?token=${SECRET}`;

function card(): MotionDoc {
  const doc = ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Image', from: 0, durationInFrames: 60, props: { assetId: 'pic' } }, 'card'));
  return ok(applyInteractivePreset(doc, InteractivePreset.CardTilt, 'card'));
}

const ORIGIN = 'https://app.test';
const PLAYER_CODE = 'window.__player=true;';
const CORE_CODE = 'export default async () => {};';
const WASM_BYTES = new Uint8Array(Array.from({ length: 4096 }, (_, i) => (i * 7) % 251));
const FONT_FILE = 'https://fonts.gstatic.com/s/dmsans/v1/dm.woff2';
const FONT_CSS = `@font-face{font-family:'DM Sans';font-style:normal;font-weight:400;src:url(${FONT_FILE}) format('woff2');unicode-range:U+0000-00FF;}`;
const SERVED: Record<string, () => Blob> = {
  '/css2': () => new Blob([FONT_CSS], { type: 'text/css' }),
  '/s/dmsans/v1/dm.woff2': () => new Blob([WASM_BYTES.slice(0, 64)], { type: 'font/woff2' }),
  [GPU_PLAYER_ROUTE]: () => new Blob([PLAYER_CODE], { type: 'text/javascript' }),
  '/gpu-core/gpu_core.js': () => new Blob([CORE_CODE], { type: 'text/javascript' }),
  '/gpu-core/gpu_core_bg.wasm': () => new Blob([WASM_BYTES], { type: 'application/wasm' })
};
const fetchBlob = async (url: string) => (SERVED[new URL(url).pathname]?.() ?? new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }));

describe('interactive web export', () => {
  it('ships the live runtime only when asked and only when an expression reads input', () => {
    const plain = newMotionDoc(MotionFormat.Square);

    expect(composeHtml({ doc: card(), tokens: FEEGA_TOKENS, assets: {} })).not.toContain(LIVE_GLOBAL);
    expect(composeHtml({ doc: plain, tokens: FEEGA_TOKENS, assets: {}, liveness: Liveness.Live })).not.toContain(LIVE_GLOBAL);
    expect(composeHtml({ doc: card(), tokens: FEEGA_TOKENS, assets: {}, liveness: Liveness.Live })).toContain(`window.${LIVE_GLOBAL}(`);
  });

  it('inlines every asset, so the file carries no signed URL and needs no session', async () => {
    const bundle = await interactiveBundle({ doc: card(), tokens: { ...FEEGA_TOKENS, logoUrl: SIGNED }, assetUrls: { pic: SIGNED }, title: 'Card', fetchBlob });

    expect(bundle.html).not.toContain(SECRET);
    expect(bundle.html).not.toContain('supabase.co');
    expect(bundle.html).toContain('data:image/png;base64,iVBORw');
    expect(bundle.bytes).toBe(new TextEncoder().encode(bundle.html).length);
  });

  it('carries the playback options and an embed snippet that feeds the host scroll', async () => {
    const doc = ok(applyInteractivePreset(card(), InteractivePreset.ScrollScrub, null));
    const bundle = await interactiveBundle({ doc, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Card', fetchBlob });

    expect(bundle.html).toContain(`"playback":"${PlayMode.Scrub}"`);
    expect(bundle.snippet).toContain('<iframe');
    expect(bundle.snippet).toContain('aspect-ratio:1080/1080');
    expect(bundle.snippet).toContain('allow="accelerometer; gyroscope"');
    expect(bundle.snippet).toContain(HOST_MESSAGE);
  });

  it('lets a vertical swipe on the embed scroll the host page when scroll scrubs the timeline', async () => {
    const scrub = ok(applyInteractivePreset(card(), InteractivePreset.ScrollScrub, null));
    const scrubbed = await interactiveBundle({ doc: scrub, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Card', fetchBlob });
    const tilted = await interactiveBundle({ doc: card(), tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Card', fetchBlob });

    expect(scrubbed.html).toContain('#pad{touch-action:pan-y}');
    expect(tilted.html).toContain('#pad{touch-action:none}');
  });

  it('feeds the embed its own progress through the viewport and honours a data-scroll wrapper', async () => {
    const bundle = await interactiveBundle({ doc: card(), tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Card', fetchBlob });

    expect(bundle.snippet).toContain('progress');
    expect(bundle.snippet).toContain('[data-scroll]');
    expect(bundle.snippet).toContain('document.currentScript.previousElementSibling');
  });

  it('lets a scrub embed opened on its own scroll its own page instead of freezing', async () => {
    const scrub = ok(applyInteractivePreset(card(), InteractivePreset.ScrollScrub, null));
    const bundle = await interactiveBundle({ doc: scrub, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Card', fetchBlob });

    expect(bundle.html).toContain(`html.${SELF_SCROLL}`);
    expect(bundle.html).toContain(`"standaloneMs":${STANDALONE_MS}`);
  });

  it('can scrub by wheel and drag when the page around it is out of reach', async () => {
    const scrub = ok(applyInteractivePreset(card(), InteractivePreset.ScrollScrub, null));
    const bundle = await interactiveBundle({ doc: scrub, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Card', fetchBlob });

    expect(bundle.html).toContain('function gestureScrub');
    expect(bundle.html).toMatch(/"scrollLength":\d/);
  });

  it('keeps the composed page from closing the player script early', async () => {
    const bundle = await interactiveBundle({ doc: card(), tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Card', fetchBlob });
    const script = bundle.html.slice(bundle.html.indexOf('<script>(function'));

    expect(script.indexOf('</script>')).toBe(script.lastIndexOf('</script>'));
  });
});

describe('a self-contained file', () => {
  const bundled = (doc = card(), fetch = fetchBlob) => interactiveBundle({ doc, tokens: FEEGA_TOKENS, assetUrls: { pic: SIGNED }, title: 'Card', fetchBlob: fetch, origin: ORIGIN });

  it('plays with gpu-core, not the HTML player', async () => {
    const { html } = await bundled();

    expect(html).toContain('<feega-gpu-player id="player" source="feega-source">');
    expect(html).not.toContain('<hyperframes-player');
    expect(html).not.toContain('hyperframes-player.global');
  });

  it('carries the video itself, so the file needs no session', async () => {
    const { html } = await bundled();

    expect(html).toContain('<script type="application/json" id="feega-source">');
    expect(html).toContain('"durationInFrames"');
    expect(html).toContain('input.pointer.x');
  });

  it('inlines the player and the gpu-core engine, so it opens from a file with no connection', async () => {
    const { html } = await bundled();

    expect(html).toContain(PLAYER_CODE);
    expect(html).toContain(`window.${INLINE_CORE_GLOBAL}=`);
    expect(html).toContain(JSON.stringify(CORE_CODE).slice(1, -1));
    expect(html).not.toMatch(/<script[^>]* src=/);
    expect(html).not.toContain(`${ORIGIN}${GPU_PLAYER_ROUTE}`);
  });

  it('stores the wasm compressed, and it comes back byte for byte', async () => {
    const { html } = await bundled();
    const wasm = /"wasm":"([A-Za-z0-9+/=]+)"/.exec(html)![1];

    expect(wasm.length).toBeLessThan(Math.ceil((WASM_BYTES.length * 4) / 3));
    expect(Array.from(await unzipBase64(wasm))).toEqual(Array.from(WASM_BYTES));
  });

  it('keeps a closing script tag in the player from ending the script early', async () => {
    const tricky = async (url: string) => (new URL(url).pathname === GPU_PLAYER_ROUTE ? new Blob(['const s = "</script><b>";'], { type: 'text/javascript' }) : fetchBlob(url));
    const { html } = await bundled(card(), tricky);
    const module = html.slice(html.indexOf('<script type="module">'));

    expect(module.slice(0, module.indexOf('</script>'))).toContain('const s = "<\\/script><b>";');
  });

  it('carries the fonts the video uses, so text still draws with no connection', async () => {
    const { html } = await bundled();
    const core = JSON.parse(/window\.__feegaGpuCore=(\{.*?\});<\/script>/s.exec(html)![1].replace(/\\u003c/g, '<'));

    expect(Object.values(core.fonts.text)).toContain(FONT_CSS);
    expect(Object.keys(core.fonts.bytes)).toEqual([FONT_FILE]);
  });

  it('tells the player where the app is, so layers that need a library can load it', async () => {
    const { html } = await bundled();

    expect(html).toContain(`"origin":"${ORIGIN}"`);
  });

  it('refuses to export when the engine cannot be fetched, instead of inlining the error page', async () => {
    const broken = async (url: string) => (new URL(url).pathname === '/gpu-core/gpu_core.js' ? new Blob(['<!doctype html><h1>404</h1>'], { type: 'text/html' }) : fetchBlob(url));
    const offline = async (url: string) => (new URL(url).pathname === GPU_PLAYER_ROUTE ? Promise.reject(new TypeError('Failed to fetch')) : fetchBlob(url));

    await expect(bundled(card(), broken)).rejects.toThrow(/gpu-core could not be loaded/);
    await expect(bundled(card(), offline)).rejects.toThrow(/player could not be loaded: Failed to fetch/);
  });
});

describe('a page published from the minified editor', () => {
  const minified = (html: string) => html.replace('(function playerMain(', '(function vi(');

  it('still answers its settings and gets the current player on read', async () => {
    const doc = newMotionDoc(MotionFormat.Landscape);
    const page = minified((await interactiveBundle({ doc, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Clip', fetchBlob, origin: ORIGIN })).html);

    expect(page).not.toContain('function playerMain(');
    expect(embedSettings(page)).toEqual({ width: doc.width, height: doc.height, playback: PlayMode.Autoplay, scrollLength: expect.any(Number), vars: [] });
    expect(upgradePlayer(page, ORIGIN)).toContain('(function playerMain(');
  });
});


describe('a frame running live on the canvas', () => {
  it('is the gpu-core player page plus a bridge that hands wheel and Esc back to the canvas', () => {
    const doc = card();
    const page = livePage({ doc, tokens: FEEGA_TOKENS, assets: {}, title: 'Clip' }, ORIGIN);

    expect(page).toContain('<feega-gpu-player id="player" source="feega-source">');
    expect(page).not.toContain('<hyperframes-player');
    expect(page).toContain('(function playerMain(');
    expect(page).toContain(LIVE_MESSAGE);
  });
});

describe('the hosted embed page', () => {
  const sourcePage = async (doc: MotionDoc) => (await import('./bundle')).embedSource({ doc, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Clip', fetchBlob, origin: ORIGIN });

  it('plays a plain video with gpu-core, loading the player from the app', async () => {
    const page = hostedPage(await sourcePage(newMotionDoc(MotionFormat.Square)), ORIGIN) ?? '';

    expect(page).toContain(`<feega-gpu-player id="player" source="feega-source">`);
    expect(page).toContain(`<script type="module" src="${ORIGIN}/motion-player.js">`);
    expect(page).toContain('"durationInFrames"');
    expect(page).not.toContain('<hyperframes-player');
  });

  it('plays an interactive video with gpu-core, not the HTML player', async () => {
    const scrubbing = ok(applyInteractivePreset(card(), InteractivePreset.ScrollScrub, null));
    const page = hostedPage(await sourcePage(scrubbing), ORIGIN) ?? '';

    expect(page).toContain('<feega-gpu-player id="player" source="feega-source">');
    expect(page).toContain(`<script type="module" src="${ORIGIN}/motion-player.js">`);
    expect(page).not.toContain('<hyperframes-player');
  });

  it('plays a video whose expressions read live input with gpu-core', async () => {
    const page = hostedPage(await sourcePage(card()), ORIGIN) ?? '';

    expect(page).toContain('<feega-gpu-player id="player" source="feega-source">');
    expect(page).toContain('input.pointer.x');
    expect(page).not.toContain('<hyperframes-player');
  });

  it('hands source.json the interactive video too, so React draws it inline', async () => {
    const source = gpuSource(await sourcePage(card()));

    expect(source?.doc.width).toBe(card().width);
    expect(source?.playback).toBe(PlayMode.Autoplay);
  });
});
