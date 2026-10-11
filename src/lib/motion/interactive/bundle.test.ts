import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, addTrack, setTrackMatte, type OpResult } from '../timeline';
import { TrackKind } from '../components';
import { Matte } from '../mask';
import { composeHtml } from '../hyperframes/compose';
import { LIVE_GLOBAL } from './runtime';
import { Liveness, PlayMode } from './settings';
import { InteractivePreset, applyInteractivePreset } from './presets';
import { SELF_SCROLL, STANDALONE_MS, embedSettings, interactiveBundle, upgradePlayer } from './bundle';
import { HOST_MESSAGE } from './host';
import { HOSTED, MOTION_LIBS_ROUTE, Script, scriptUrl } from '../libs/catalog';
import { writeComponent } from '../custom/ops';
import { ComponentMode } from '../custom/component';
import { EVENT_MESSAGE } from '../custom/runtime';

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
const libraryCode = (url: string) => `window.__loaded=(window.__loaded||[]).concat(${JSON.stringify(url)});`;
const fetchBlob = async (url: string) => (url.includes(MOTION_LIBS_ROUTE) ? new Blob([libraryCode(url)], { type: 'text/javascript' }) : new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }));

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
  const sketch = { source: { html: '', css: '', js: 'p5((p) => { p.draw = () => p.circle(0, 0, 9); });' }, propsSchema: { type: 'object' as const, properties: {} } };
  const sketched = () => ok(addClip(ok(writeComponent(newMotionDoc(MotionFormat.Square), 'Sketch', sketch)), { component: 'Custom', from: 0, durationInFrames: 60, props: { name: 'Sketch' } }, 's1'));
  const inlined = (html: string) => Object.values(Script).filter((s) => html.includes(JSON.stringify(libraryCode(scriptUrl(ORIGIN, s))).slice(1, -1)) || html.includes(libraryCode(scriptUrl(ORIGIN, s))));

  it('inlines the player, the runtime and exactly the libraries its components use', async () => {
    const bundle = await interactiveBundle({ doc: sketched(), tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Sketch', fetchBlob, origin: ORIGIN });

    expect(inlined(bundle.html).sort()).toEqual([Script.P5, Script.Player, Script.Runtime].sort());
  });

  it('loads no script from the network, so it opens from a file with no connection', async () => {
    const bundle = await interactiveBundle({ doc: sketched(), tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Sketch', fetchBlob, origin: ORIGIN });

    expect(bundle.html).not.toMatch(/<script[^>]* src=/);
    expect(bundle.html).not.toMatch(/<script[^>]* src=\\"/);
    expect(bundle.html).not.toContain('jsdelivr');
  });

  it('carries the licence of every library it inlines', async () => {
    const bundle = await interactiveBundle({ doc: sketched(), tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Sketch', fetchBlob, origin: ORIGIN });
    const head = bundle.html.slice(0, bundle.html.indexOf('<html'));

    for (const script of [Script.P5, Script.Player, Script.Runtime]) {
      expect(head).toContain(`${HOSTED[script].name}@${HOSTED[script].version} (${HOSTED[script].licence})`);
    }
    expect(head).toContain(`${scriptUrl(ORIGIN, Script.P5).replace(HOSTED[Script.P5].file, HOSTED[Script.P5].licenceFile)}`);
    expect(head).not.toContain('d3@');
  });

  const model = () => ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Model3D', from: 0, durationInFrames: 60, props: { assetId: 'glb' } }, 'm'));
  const matted = () => {
    const below = ok(addClip(newMotionDoc(MotionFormat.Square), { component: 'Image', from: 0, durationInFrames: 60, props: { assetId: 'pic' } }, 'img'));
    const above = ok(addClip(ok(addTrack(below, TrackKind.Visual, 'top')), { component: 'Title', from: 0, durationInFrames: 60, trackId: 'top', props: { text: 'GO' } }, 'src'));
    return ok(setTrackMatte(above, 'img', Matte.Alpha));
  };

  it('inlines the three.js modules of a built-in 3D clip instead of importing them from our origin', async () => {
    const bundle = await interactiveBundle({ doc: model(), tokens: FEEGA_TOKENS, assetUrls: { glb: 'https://x.test/a.glb' }, title: '3D', fetchBlob, origin: ORIGIN });

    expect(bundle.html).not.toContain(`${ORIGIN}${MOTION_LIBS_ROUTE}/three@`);
    expect(bundle.html).toContain('\\"three\\":\\"data:text/javascript;base64,');
  });

  it('inlines the screenshot library a matte needs', async () => {
    const bundle = await interactiveBundle({ doc: matted(), tokens: FEEGA_TOKENS, assetUrls: { pic: 'https://x.test/p.png' }, title: 'Matte', fetchBlob, origin: ORIGIN });

    expect(inlined(bundle.html)).toContain(Script.Screenshot);
    expect(bundle.html).not.toMatch(/script-src[^;]*html-to-image/);
    expect(bundle.html).not.toContain(`\\"lib\\":\\"${scriptUrl(ORIGIN, Script.Screenshot)}`);
  });

  it('refuses to export when a library cannot be fetched, instead of inlining the error page', async () => {
    const broken = async (url: string) => (url.includes('/p5@') ? new Blob(['<!doctype html><h1>404</h1>'], { type: 'text/html' }) : fetchBlob(url));
    const offline = async (url: string) => (url.includes('/p5@') ? Promise.reject(new TypeError('Failed to fetch')) : fetchBlob(url));

    await expect(interactiveBundle({ doc: sketched(), tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Sketch', fetchBlob: broken, origin: ORIGIN })).rejects.toThrow(/p5@1\.11\.11 could not be loaded/);
    await expect(interactiveBundle({ doc: sketched(), tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Sketch', fetchBlob: offline, origin: ORIGIN })).rejects.toThrow(/could not be loaded: Failed to fetch/);
  });
});

describe('a live component in the embed', () => {
  const game = { source: { html: '', css: '', js: 'requestAnimationFrame(function f() { requestAnimationFrame(f); });' }, propsSchema: { type: 'object' as const, properties: {} }, mode: ComponentMode.Live };
  const played = () => ok(addClip(ok(writeComponent(newMotionDoc(MotionFormat.Square), 'Game', game)), { component: 'Custom', from: 0, durationInFrames: 60, props: { name: 'Game' } }, 'g1'));

  it('runs live and gets the keys and taps the player forwards', async () => {
    const bundle = await interactiveBundle({ doc: played(), tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Game', fetchBlob });

    expect(bundle.html).toContain('\\"play\\":\\"live\\"');
    expect(bundle.html).toContain(`"eventMessage":"${EVENT_MESSAGE}"`);
  });
});

describe('a page published from the minified editor', () => {
  const minified = (html: string) => html.replace('(function playerMain(', '(function vi(');

  it('still answers its settings and gets the current player on read', async () => {
    const doc = newMotionDoc(MotionFormat.Landscape);
    const page = minified((await interactiveBundle({ doc, tokens: FEEGA_TOKENS, assetUrls: {}, title: 'Clip', fetchBlob, origin: ORIGIN })).html);

    expect(page).not.toContain('function playerMain(');
    expect(embedSettings(page)).toEqual({ width: doc.width, height: doc.height, playback: PlayMode.Autoplay, scrollLength: expect.any(Number) });
    expect(upgradePlayer(page, ORIGIN)).toContain('(function playerMain(');
  });
});

