import { THREE_D_COMPONENTS, type ComponentId } from '../components';
import { Ease, TransitionKind, type Edge } from '../design';
import { GSAP_EASE, easeName } from '../keyframes';
import type { MotionClip, MotionDoc } from '../doc';
import { resolveColor, type BrandTokens } from '../brand';
import { css, esc, js, seconds } from './html';
import { TEMPLATES, Timing, type PropsOf, type TemplateCtx, type Tween, type Vars } from './templates';
import { LIGHTING, threeImportMap, threeScript, type ThreeClip } from './three';
import { bakeComposition, compositionScript, type TimedBake } from './composition';
import { ANIMATE_CSS, animationScript, colourOverrides, sceneKeys, wrapAnimated, wrapParents } from './animate';
import { ancestorsOf, parentsWithChildren } from '../parent';
import { MASK_CSS, MaskScope, maskLayer, startValues } from './masks';
import { SCREENSHOT_URL, captureScript, contentStamp } from './capture';
import { cspMeta } from './csp';
import { THREE_VERSION } from './three';
import { Library, THREE_GLOBAL, bootScript, definitionScript, librariesOf, seedOf, type CustomRun } from '../custom/runtime';
import { PropFormat, type CustomComponents } from '../custom/component';
import { hiddenMattes, matteMask, matteSource } from '../matte';
import { Matte, type Mask } from '../mask';
import { Composite, cameraMath, stageSpec } from '../camera';
import { sampleTrack } from '../keyframes';
import { STAGE_CSS, stageRootStyle, stageScript } from './stage';
import { bakeExpressions } from '../expression/bake';
import { declaredFamilyCss, faceDescriptor, fontStack, googleFontsUrl, loadedWeight, uploadFaceCss, usedFaces } from '../fonts/model';
import { EFFECT_CSS, effectLayer, effectScript, effectTimeline } from '../effects/render';
import { blendStyle } from '../blend';

export { CAPTURE_REPLY, CAPTURE_REQUEST } from './capture';

export const HYPERFRAMES_VERSION = '0.8.114';
export const GSAP_VERSION = '3.14.2';
export const COMPOSITION_ID = 'main';

const RUNTIME_URL = `https://cdn.jsdelivr.net/npm/@hyperframes/core@${HYPERFRAMES_VERSION}/dist/hyperframe.runtime.iife.js`;
const GSAP_URL = `https://cdn.jsdelivr.net/npm/gsap@${GSAP_VERSION}/dist/gsap.min.js`;
const SPLIT_TEXT_URL = `https://cdn.jsdelivr.net/npm/gsap@${GSAP_VERSION}/dist/SplitText.min.js`;
export const LOTTIE_VERSION = '5.13.0';
const LOTTIE_URL = `https://cdn.jsdelivr.net/npm/lottie-web@${LOTTIE_VERSION}/build/player/lottie_light.min.js`;
const THREE_BASE = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/`;
const FONTS_URL = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Fragment+Mono&display=block';

const SHOWN: Vars = { opacity: 1, xPercent: 0, yPercent: 0, scale: 1, clipPath: 'inset(0 0% 0 0)', filter: 'blur(0px)' };

const HIDDEN: Record<TransitionKind, Vars> = {
  [TransitionKind.None]: {},
  [TransitionKind.Fade]: { opacity: 0 },
  [TransitionKind.SlideUp]: { opacity: 0, yPercent: 12 },
  [TransitionKind.SlideDown]: { opacity: 0, yPercent: -12 },
  [TransitionKind.SlideLeft]: { opacity: 0, xPercent: 12 },
  [TransitionKind.SlideRight]: { opacity: 0, xPercent: -12 },
  [TransitionKind.Scale]: { opacity: 0, scale: 0.86 },
  [TransitionKind.Wipe]: { clipPath: 'inset(0 100% 0 0)' },
  [TransitionKind.Blur]: { opacity: 0, filter: 'blur(24px)' }
};

const MOVE: Record<PropsOf<'Image'>['move'], { from: Vars; to: Vars }> = {
  none: { from: {}, to: {} },
  'drift-up': { from: { yPercent: 6 }, to: { yPercent: 0 } },
  'zoom-in': { from: { scale: 1 }, to: { scale: 1.12 } },
  'zoom-out': { from: { scale: 1.12 }, to: { scale: 1 } },
  'pan-left': { from: { scale: 1.12, xPercent: 3 }, to: { scale: 1.12, xPercent: -3 } },
  'pan-right': { from: { scale: 1.12, xPercent: -3 }, to: { scale: 1.12, xPercent: 3 } }
};

export type ComposeInput = { doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string> };

function pick(vars: Vars, keys: string[]): Vars {
  return Object.fromEntries(keys.map((k) => [k, vars[k]]));
}

function edgeTweens(clip: MotionClip, fps: number): Tween[] {
  const target = `#fx-${clip.id}`;
  const start = clip.from / fps;
  const end = (clip.from + clip.durationInFrames) / fps;
  const tweens: Tween[] = [];

  const enter: Edge = clip.transitionIn;
  if (enter.kind !== TransitionKind.None && enter.durationInFrames > 0) {
    const hidden = HIDDEN[enter.kind];
    tweens.push({ target, from: hidden, to: pick(SHOWN, Object.keys(hidden)), at: start, duration: enter.durationInFrames / fps, ease: Ease.Enter });
  }

  const exit: Edge = clip.transitionOut;
  if (exit.kind !== TransitionKind.None && exit.durationInFrames > 0) {
    const hidden = HIDDEN[exit.kind];
    const duration = exit.durationInFrames / fps;
    tweens.push({ target, from: pick(SHOWN, Object.keys(hidden)), to: hidden, at: end - duration, duration, ease: Ease.Exit });
  }

  return tweens;
}

function moveTweens(clip: MotionClip, fps: number): Tween[] {
  const p = clip.props as { move?: PropsOf<'Image'>['move']; easing?: Ease };
  if (!p.move || p.move === 'none') {
    return [];
  }
  const move = MOVE[p.move];
  return [{ target: `#mv-${clip.id}`, from: move.from, to: move.to, at: clip.from / fps, duration: clip.durationInFrames / fps, ease: p.easing ?? Ease.Standard }];
}

function ctxOf(clip: MotionClip, input: ComposeInput): TemplateCtx<ComponentId> {
  const { doc, tokens, assets } = input;
  return {
    id: clip.id,
    p: { ...clip.props, ...colourOverrides(clip) } as never,
    width: doc.width,
    height: doc.height,
    unit: Math.min(doc.width, doc.height),
    start: Number(seconds(clip.from, doc.fps)),
    length: Number(seconds(clip.durationInFrames, doc.fps)),
    fps: doc.fps,
    color: (v) => (v.startsWith('var(') ? v : resolveColor(v, tokens)),
    asset: (id) => (id ? (assets[id] ?? null) : null),
    logoUrl: tokens.logoUrl,
    brandName: tokens.name,
    mediaStart: Number(seconds(clip.trimStart, doc.fps)),
    components: doc.components,
    font: (family) => fontStack(family, doc.fonts),
    weight: (family, weight) => loadedWeight(family, weight, doc.fonts)
  };
}

function ownMask(clip: MotionClip, ctx: TemplateCtx<ComponentId>, inner: string): string {
  if (!clip.mask) {
    return inner;
  }
  return maskLayer({ scope: MaskScope.Own, clipId: clip.id, mask: clip.mask, values: startValues(clip.mask, clip.keyframes), frame: ctx, url: ctx.asset(clip.mask.assetId) }, inner);
}

function matteOf(doc: MotionDoc, clip: MotionClip): Mask | null {
  if (clip.matte === Matte.None) {
    return null;
  }
  const source = matteSource(doc, clip.id);
  return source ? matteMask(source, clip.matte) : null;
}

function matted(clip: MotionClip, ctx: TemplateCtx<ComponentId>, matte: Mask | null, inner: string): string {
  if (!matte) {
    return inner;
  }
  return maskLayer({ scope: MaskScope.Matte, clipId: clip.id, mask: matte, values: startValues(matte, {}), frame: ctx, url: ctx.asset(matte.assetId) }, inner);
}

enum Visibility {
  Shown = 'shown',
  MatteSource = 'matte-source'
}

type Placed = { layer: number; trackIndex: number; matte: Mask | null; visibility: Visibility; transform?: string; chain: MotionClip[] };

function clipHtml(clip: MotionClip, ctx: TemplateCtx<ComponentId>, placed: Placed): string {
  const template = TEMPLATES[clip.component] as (typeof TEMPLATES)[ComponentId];
  const inner = matted(clip, ctx, placed.matte, wrapParents(placed.chain, clip, ctx, wrapAnimated(clip, ctx, effectLayer(clip, ctx, ctx.color, ownMask(clip, ctx, template.html(ctx as never))))));
  const fx = `<div class="fx" id="fx-${clip.id}">${inner}</div>`;
  const style = css({ zIndex: placed.layer, transform: placed.transform, mixBlendMode: blendStyle(clip.blend) });
  const layer =
    template.timing === Timing.Media
      ? `<div class="layer" data-clip="${esc(clip.id)}" style="${style}">${fx}</div>`
      : `<div id="c-${clip.id}" class="clip layer" data-clip="${esc(clip.id)}" data-start="${ctx.start}" data-duration="${ctx.length}" data-track-index="${placed.trackIndex}" style="${style}">${fx}</div>`;

  return placed.visibility === Visibility.MatteSource ? `<div class="matte-src" style="display:none">${layer}</div>` : layer;
}

function tweenLine(t: Tween): string {
  return `tl.fromTo(${js(t.target)},${js(t.from)},${js({ ...t.to, duration: round(t.duration), ease: GSAP_EASE[t.ease], immediateRender: false })},${round(t.at)});`;
}

type Hold = { target: string; vars: Vars; at: number };

function heldUntilStart(tweens: Tween[], clipStart: number): Hold[] {
  return tweens.filter((t) => t.at > clipStart).map((t) => ({ target: t.target, vars: t.from, at: clipStart }));
}

function holdLine(h: Hold): string {
  return `tl.set(${js(h.target)},${js(h.vars)},${round(h.at)});`;
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function threeClipOf(clip: MotionClip, ctx: TemplateCtx<ComponentId>, staged: boolean): ThreeClip {
  const p = clip.props as PropsOf<'Model3D'> & Partial<PropsOf<'Shape3D'>>;
  return {
    id: clip.id,
    kind: clip.component === 'Model3D' ? 'model' : 'shape',
    url: ctx.asset(p.assetId ?? null),
    shape: p.shape ?? 'cube',
    color: ctx.color(p.fill ?? 'brand.accent'),
    start: ctx.start,
    length: ctx.length,
    startAngle: p.startAngle,
    endAngle: p.endAngle,
    orbitSpeed: p.orbitSpeed,
    zoom: p.zoom,
    lighting: p.lighting in LIGHTING ? p.lighting : 'studio',
    shadow: p.shadow,
    ease: GSAP_EASE[p.easing],
    fps: ctx.fps,
    keys: sceneKeys(clip),
    depth: staged ? clip.depth : null
  };
}

function compositionBake(clip: MotionClip, ctx: TemplateCtx<ComponentId>): TimedBake {
  const bake = bakeComposition(clip.id, clip.props as PropsOf<'Composition'>, ctx, ctx.asset);
  return { ...bake, start: ctx.start, length: ctx.length };
}

const BASE_CSS = [
  'html,body{margin:0;padding:0;background:transparent}',
  '#root{position:relative;width:100%;height:100%;overflow:hidden;isolation:isolate}',
  '.layer{position:absolute;inset:0}',
  '.fx{position:absolute;inset:0;will-change:transform,opacity}',
  '.cc{position:absolute;inset:0;overflow:hidden}',
  '.li{display:block;will-change:transform}',
  ANIMATE_CSS,
  MASK_CSS,
  EFFECT_CSS,
  '.font-probe{position:absolute;left:0;top:0;opacity:0;pointer-events:none}'
].join('');

type ValueResolver = (value: unknown, ctx: TemplateCtx<ComponentId>) => unknown;

const RESOLVE: Record<PropFormat, ValueResolver> = {
  [PropFormat.Color]: (v, ctx) => ctx.color(String(v)),
  [PropFormat.Asset]: (v, ctx) => ctx.asset(typeof v === 'string' ? v : null),
  [PropFormat.Textarea]: (v) => v,
  [PropFormat.Font]: (v, ctx) => ctx.font(String(v))
};

function customRun(clip: MotionClip, ctx: TemplateCtx<ComponentId>, components: CustomComponents): CustomRun | null {
  const { name, ...given } = clip.props as { name: string } & Record<string, unknown>;
  const component = components[name];
  if (!component) {
    return null;
  }
  const values = Object.fromEntries(
    Object.entries(component.propsSchema.properties).map(([key, spec]) => [key, spec.format ? RESOLVE[spec.format](given[key], ctx) : given[key]])
  );
  const keys = Object.fromEntries(
    Object.entries(clip.keyframes)
      .filter(([key]) => key in component.propsSchema.properties)
      .map(([key, track]) => [key, track.map((k) => ({ at: round(k.frame / ctx.fps), value: typeof k.value === 'string' ? ctx.color(k.value) : k.value, ease: easeName(k.ease) }))])
  );
  return { id: clip.id, name, start: ctx.start, length: ctx.length, fps: ctx.fps, values, seed: seedOf(clip.id), ...(Object.keys(keys).length ? { keys } : {}), ...(ctx.mediaStart ? { trim: ctx.mediaStart } : {}) };
}

const LIBRARY_TAGS: Record<Library, { scripts: string[]; tag: string }> = {
  [Library.SplitText]: { scripts: [SPLIT_TEXT_URL], tag: `<script src="${SPLIT_TEXT_URL}"></script><script>gsap.registerPlugin(SplitText);</script>` },
  [Library.Lottie]: { scripts: [LOTTIE_URL], tag: `<script src="${LOTTIE_URL}"></script>` },
  [Library.Three]: { scripts: [THREE_BASE], tag: '' }
};

function brandEnv(tokens: BrandTokens) {
  const colors = Object.fromEntries(Object.entries(tokens.colors).map(([k, v]) => [k.replace('brand.', ''), v]));
  return { name: tokens.name, colors, logoUrl: tokens.logoUrl };
}

export const FONTS_READY = '__fontsReady';
const FONT_SHEET = 'kf-fonts';

function fontLinks(doc: MotionDoc, assets: Record<string, string>): string {
  const faces = usedFaces(doc);
  const google = googleFontsUrl(faces, doc.fonts);
  const uploads = uploadFaceCss(doc.fonts, assets) + declaredFamilyCss(faces, doc.fonts);
  const loads = faces.map((f) => `document.fonts.load(${js(faceDescriptor(f))}).catch(function(){return [];})`).join(',');
  return [
    google ? `<link id="${FONT_SHEET}" rel="stylesheet" crossorigin="anonymous" href="${esc(google)}" />` : '',
    uploads ? `<style>${uploads}</style>` : '',
    `<script>(function(){var l=document.getElementById(${js(FONT_SHEET)});var sheet=l&&!l.sheet?new Promise(function(r){l.addEventListener('load',r);l.addEventListener('error',r);}):Promise.resolve();window.${FONTS_READY}=sheet.then(function(){return Promise.all([${loads}]);}).then(function(){return document.fonts.ready;});})();</script>`
  ].join('');
}

function fontProbe(doc: MotionDoc): string {
  const spans = usedFaces(doc)
    .map((f) => `<span style="${css({ fontFamily: fontStack(f.family, doc.fonts), fontWeight: loadedWeight(f.family, f.weight, doc.fonts), fontStyle: f.italic ? 'italic' : 'normal' })}">Aa</span>`)
    .join('');
  return spans ? `<div class="font-probe" aria-hidden="true">${spans}</div>` : '';
}

function gated(script: string): string {
  const rerender = `var m=window.__timelines&&window.__timelines[${js(COMPOSITION_ID)}];if(m){m.render(m.totalTime(),false,true);}`;
  return script ? `(window.${FONTS_READY}||Promise.resolve()).then(function(){${script}${rerender}});` : '';
}

export function composeHtml(raw: ComposeInput): string {
  const input = { ...raw, doc: bakeExpressions(raw.doc) };
  const { doc, tokens } = input;
  const bottomFirst = doc.tracks.map((track, index) => ({ track, index })).reverse();
  const layers: string[] = [];
  const tweens: Tween[] = [];
  const holds: Hold[] = [];
  const three: ThreeClip[] = [];
  const compositions: TimedBake[] = [];
  const clips: MotionClip[] = [];
  const runs: CustomRun[] = [];
  const hidden = hiddenMattes(doc);
  const stage = doc.camera ? stageSpec(doc) : null;
  const onStage = new Set(stage?.layers.filter((l) => l.composite === Composite.World).map((l) => l.id));
  const startPose = new Map(stage ? cameraMath(sampleTrack).frameAt(stage, 0).layers.map((l) => [l.id, l.transform]) : []);
  const world: string[] = [];
  const byId = new Map(doc.tracks.flatMap((t) => t.clips as MotionClip[]).map((c) => [c.id, c]));
  let layer = 0;

  for (const { track, index } of bottomFirst) {
    for (const clip of track.clips as MotionClip[]) {
      const ctx = ctxOf(clip, input);
      clips.push(clip);
      const template = TEMPLATES[clip.component] as (typeof TEMPLATES)[ComponentId];
      layer += 1;
      const html = clipHtml(clip, ctx, { layer, trackIndex: index, matte: matteOf(doc, clip), visibility: hidden.has(clip.id) ? Visibility.MatteSource : Visibility.Shown, transform: startPose.get(clip.id), chain: ancestorsOf(doc, clip.id).map((id) => byId.get(id)!) });
      (onStage.has(clip.id) ? world : layers).push(html);
      const own = template.tweens?.(ctx as never) ?? [];
      tweens.push(...edgeTweens(clip, doc.fps), ...moveTweens(clip, doc.fps), ...own);
      holds.push(...heldUntilStart(own, ctx.start));
      if (THREE_D_COMPONENTS.includes(clip.component)) {
        three.push(threeClipOf(clip, ctx, onStage.has(clip.id)));
      }
      if (clip.component === 'Composition') {
        compositions.push(compositionBake(clip, ctx));
      }
      const run = clip.component === 'Custom' ? customRun(clip, ctx, doc.components) : null;
      if (run) {
        runs.push(run);
      }
    }
  }

  const duration = seconds(doc.durationInFrames, doc.fps);
  const background = tokens.colors['brand.background'];
  const animation = animationScript(clips, doc, (v) => resolveColor(v, tokens), parentsWithChildren(doc));
  const used = new Set(runs.map((r) => r.name));
  const libraries = librariesOf(doc.components, used);
  const threeCustom = libraries.has(Library.Three);
  const env = { assets: input.assets, brand: brandEnv(tokens) };
  const boot = gated(bootScript(runs, env, `window.__timelines[${js(COMPOSITION_ID)}]`));
  const definitions = [...used].map((name) => definitionScript(name, doc.components[name].source.js)).join('');
  const customBoot = threeCustom
    ? `<script type="module">import * as THREE from 'three';window.${THREE_GLOBAL}=THREE;${boot}</script>`
    : boot
      ? `<script>${boot}</script>`
      : '';
  const scripts = [RUNTIME_URL, GSAP_URL, SCREENSHOT_URL, ...(three.length || compositions.length ? [THREE_BASE] : []), ...[...libraries].flatMap((lib) => LIBRARY_TAGS[lib].scripts)];
  const assetUrls = [...Object.values(input.assets), ...(tokens.logoUrl ? [tokens.logoUrl] : [])];

  const page = [
    '<!doctype html><html lang="en"><head><meta charset="UTF-8" />',
    `<meta name="viewport" content="width=${doc.width}, height=${doc.height}" />`,
    cspMeta({ scripts: [...new Set(scripts)], assetUrls }),
    `<script src="${RUNTIME_URL}"></script>`,
    `<script src="${GSAP_URL}"></script>`,
    ...[...libraries].map((lib) => LIBRARY_TAGS[lib].tag),
    three.length || compositions.length || threeCustom ? threeImportMap() : '',
    `<link rel="stylesheet" crossorigin="anonymous" href="${FONTS_URL}" />`,
    fontLinks(doc, input.assets),
    `<style>${BASE_CSS}#root{background:${esc(background)}}${stage ? STAGE_CSS + stageRootStyle(stage) : ''}</style>`,
    '</head><body>',
    `<div id="root" data-composition-id="${COMPOSITION_ID}" data-start="0" data-width="${doc.width}" data-height="${doc.height}" data-duration="${duration}" data-fps="${doc.fps}">`,
    stage ? `<div id="world" class="world">${world.join('')}</div><!--/world-->` : '',
    layers.join(''),
    fontProbe(doc),
    '</div>',
    `<script>${animation.setup}const tl=gsap.timeline({paused:true});${holds.map(holdLine).join('')}${tweens.map(tweenLine).join('')}${animation.timeline}${effectScript(clips.flatMap((c) => effectTimeline(c, doc, (v) => resolveColor(v, tokens))))}tl.set({}, {}, ${duration});window.__timelines=window.__timelines||{};window.__timelines[${js(COMPOSITION_ID)}]=tl;</script>`,
    definitions,
    customBoot,
    stage ? `<script>${stageScript(stage, doc.fps, Number(duration))}</script>` : '',
    threeScript(three, Number(duration), stage),
    compositionScript(compositions, Number(duration))
  ].join('');
  return `${page}${captureScript(doc, contentStamp(page))}</body></html>`;
}
