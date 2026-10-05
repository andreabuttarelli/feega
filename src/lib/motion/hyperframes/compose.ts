import { THREE_D_COMPONENTS, type ComponentId } from '../components';
import { Ease, TransitionKind, type Edge } from '../design';
import { EASE_NAME, easeName } from '../keyframes';
import { Background, clipsOf, type MotionClip, type MotionDoc } from '../doc';
import { resolveColor, type BrandTokens } from '../brand';
import { css, esc, js, seconds } from './html';
import { TEMPLATES, Timing, type PropsOf, type TemplateCtx, type Tween, type Vars } from './templates';
import { LIGHTING, OPENTYPE_URL, ThreeKind, lookRuntime, surfaceOf, threeAssetUrls, threeImportMap, threeScript, type ThreeClip } from './three';
import { outlineUrl } from '../fonts/outline';
import { Finish } from '../devices';
import { deviceRuntime } from './device-runtime';
import { bakeComposition, compositionScript, type TimedBake } from './composition';
import { ANIMATE_CSS, ENGINE, animationScript, keyedOverrides, sceneKeys, wrapAnimated, wrapParents } from './animate';
import { ancestorsOf, parentsWithChildren } from '../parent';
import { MASK_CSS, MaskScope, maskLayer, startValues } from './masks';
import { SCREENSHOT_URL, captureScript, contentStamp } from './capture';
import { cspMeta } from './csp';
import { THREE_VERSION } from './three';
import { Library, THREE_GLOBAL, bootScript, definitionScript, librariesOf, seedOf, type CustomRun } from '../custom/runtime';
import { PropFormat, type CustomComponents } from '../custom/component';
import { mattePairs, type MattePair } from '../matte';
import { matteScript, matteWrapper } from './mattes';
import { Composite, cameraMath, stageSpec } from '../camera';
import { sampleTrack } from '../keyframes';
import { STAGE_CSS, stageRootStyle, stageScript } from './stage';
import { shapeBake, shapeScript, type ShapeBake } from './shapes';
import { particleBake, particleScript } from './particles';
import { remappedSegments } from '../time-remap';
import type { ParticleBake } from '../particles/simulate';
import { bakeExpressions } from '../expression/bake';
import type { AudioAnalysis } from '../audio-analysis';
import { FIT_TEXT, fitScript } from './fit-runtime';
import { HOT_CLOSE, HOT_MODULE, HOT_OPEN, HOT_SCRIPT, hotRuntime } from './hot';
import { ANIMATOR_CSS, textRender } from '../text-animators/render';
import { declaredFamilyCss, fontStack, loadDescriptors, googleFontsUrl, loadedWeight, uploadFaceCss, usedFaces } from '../fonts/model';
import { bakePaths } from '../path';
import { bakePhysics } from '../physics/simulate';
import { withoutHidden } from '../organize';
import { EFFECT_CSS, adjustmentLayer, adjustmentTimeline, effectLayer, effectScript, effectTimeline, type EffectSet } from '../effects/render';
import { flattenComps, type GroupProps } from '../precomp';
import { blendStyle } from '../blend';
import { HELD, holdScript } from './blur';
import { engineScript } from '../engine/engine';

export { CAPTURE_REPLY, CAPTURE_REQUEST } from './capture';

export const HYPERFRAMES_VERSION = '0.8.114';
export const COMPOSITION_ID = 'main';

const RUNTIME_URL = `https://cdn.jsdelivr.net/npm/@hyperframes/core@${HYPERFRAMES_VERSION}/dist/hyperframe.runtime.iife.js`;
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

export type ComposeInput = { doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string>; scale?: number; analyses?: Record<string, AudioAnalysis> };

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
    p: { ...clip.props, ...keyedOverrides(clip) } as never,
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
    weight: (family, weight) => loadedWeight(family, weight, doc.fonts),
    text: textRender(clip.id, clip.animators, (v) => resolveColor(v, tokens)),
    remap: () => remappedSegments(clip, doc.fps)
  };
}

function ownMask(clip: MotionClip, ctx: TemplateCtx<ComponentId>, inner: string): string {
  if (!clip.mask) {
    return inner;
  }
  const primary = { mask: clip.mask, values: startValues(clip.mask, clip.keyframes), url: ctx.asset(clip.mask.assetId) };
  const stacked = clip.maskStack.map((mask) => ({ mask, values: startValues(mask, {}), url: ctx.asset(mask.assetId) }));
  return maskLayer({ scope: MaskScope.Own, clipId: clip.id, masks: [primary, ...stacked], frame: ctx }, inner);
}

function matted(matte: MattePair | null, inner: string): string {
  return matte ? matteWrapper(matte, inner) : inner;
}

enum Visibility {
  Shown = 'shown',
  MatteSource = 'matte-source'
}

type Placed = { layer: number; trackIndex: number; matte: MattePair | null; visibility: Visibility; transform?: string; chain: MotionClip[]; held: boolean; group?: string };

function clipHtml(clip: MotionClip, ctx: TemplateCtx<ComponentId>, placed: Placed, content: string): string {
  const template = TEMPLATES[clip.component] as (typeof TEMPLATES)[ComponentId];
  const inner = matted(placed.matte, wrapParents(placed.chain, clip, ctx, wrapAnimated(clip, ctx, effectLayer(clip, ctx, ctx.color, ownMask(clip, ctx, content)))));
  const fx = `<div class="fx" id="fx-${clip.id}">${inner}</div>`;
  const style = css({ zIndex: placed.layer, transform: placed.transform, mixBlendMode: blendStyle(clip.blend) });
  const blur = (placed.held ? ` ${HELD}` : '') + (placed.group ? ` data-group="${esc(placed.group)}"` : '');
  const layer =
    template.timing === Timing.Media
      ? `<div class="layer" data-clip="${esc(clip.id)}"${blur} style="${style}">${fx}</div>`
      : `<div id="c-${clip.id}" class="clip layer" data-clip="${esc(clip.id)}" data-start="${ctx.start}" data-duration="${ctx.length}" data-track-index="${placed.trackIndex}"${blur} style="${style}">${fx}</div>`;

  return placed.visibility === Visibility.MatteSource ? `<div class="matte-src" style="${css({ opacity: 0, pointerEvents: 'none' })}">${layer}</div>` : layer;
}

type TrackStarts = ReadonlyMap<number, number>;
type GroupSpec = {
  firstLayer: (clip: MotionClip, trackIndex: number, starts: TrackStarts) => number;
  html: (clip: MotionClip, ctx: TemplateCtx<ComponentId>, placed: Placed, content: string) => string;
  effects: (clip: MotionClip, ctx: TemplateCtx<ComponentId>) => EffectSet[];
};

const GROUPS: Partial<Record<ComponentId, GroupSpec>> = {
  Precomp: {
    firstLayer: (clip, trackIndex, starts) => starts.get(trackIndex + ((clip.props as GroupProps).span ?? 0)) ?? 0,
    html: (clip, ctx, placed, content) => `${clipHtml(clip, ctx, { ...placed, group: clip.id }, content)}<!--/group:${esc(clip.id)}-->`,
    effects: (clip, ctx) => effectTimeline(clip, ctx, ctx.color)
  },
  Adjustment: {
    firstLayer: () => 0,
    html: (clip, ctx, placed, content) => adjustmentLayer(clip, ctx, ctx.color, content, placed.layer),
    effects: (clip, ctx) => adjustmentTimeline(clip, ctx, ctx.color)
  }
};

function tweenLine(t: Tween): string {
  return `tl.fromTo(${js(t.target)},${js(t.from)},${js({ ...t.to, duration: round(t.duration), ease: EASE_NAME[t.ease], immediateRender: false })},${round(t.at)});`;
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

const THREE_KIND: Partial<Record<ComponentId, ThreeKind>> = {
  Model3D: ThreeKind.Model,
  Shape3D: ThreeKind.Shape,
  Text3D: ThreeKind.Text,
  Logo3D: ThreeKind.Logo,
  Device3D: ThreeKind.Device
};

type ThreeProps = PropsOf<'Model3D'> & Partial<PropsOf<'Shape3D'>> & Partial<PropsOf<'Text3D'>> & Partial<PropsOf<'Logo3D'>> & Partial<PropsOf<'Device3D'>>;

function threeUrl(kind: ThreeKind, p: ThreeProps, ctx: TemplateCtx<ComponentId>, input: ComposeInput): string | null {
  const URL_OF: Record<ThreeKind, () => string | null> = {
    [ThreeKind.Model]: () => ctx.asset(p.assetId ?? null),
    [ThreeKind.Shape]: () => null,
    [ThreeKind.Logo]: () => ctx.asset(p.assetId ?? null) ?? ctx.logoUrl ?? null,
    [ThreeKind.Text]: () => outlineUrl(p.font ?? '', p.weight ?? 400, input.doc.fonts, input.assets),
    [ThreeKind.Device]: () => ctx.asset(p.screen ?? null)
  };
  return URL_OF[kind]();
}

function threeClipOf(clip: MotionClip, ctx: TemplateCtx<ComponentId>, staged: boolean, input: ComposeInput): ThreeClip {
  const p = clip.props as ThreeProps;
  const kind = THREE_KIND[clip.component] ?? ThreeKind.Shape;
  return {
    id: clip.id,
    kind,
    url: threeUrl(kind, p, ctx, input),
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
    ease: EASE_NAME[p.easing],
    fps: ctx.fps,
    keys: sceneKeys(clip),
    depth: staged ? clip.depth : null,
    surface: surfaceOf(p.material),
    text: p.text ?? '',
    extrude: p.extrude ?? 0,
    bevel: p.bevel ?? 0,
    device: p.device ? deviceRuntime(p.device, p.finish ?? Finish.Default, ctx) : null,
    video: Boolean(ctx.asset(p.screenVideo ?? null))
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
  ANIMATOR_CSS,
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
  const loads = loadDescriptors(doc).map((d) => `document.fonts.load(${js(d)}).catch(function(){return [];})`).join(',');
  return [
    google ? `<link id="${FONT_SHEET}" rel="stylesheet" crossorigin="anonymous" href="${esc(google)}" />` : '',
    uploads ? `<style>${uploads}</style>` : '',
    `<script>(function(){var l=document.getElementById(${js(FONT_SHEET)});var sheet=l&&!l.sheet?new Promise(function(r){l.addEventListener('load',r);l.addEventListener('error',r);}):Promise.resolve();window.${FONTS_READY}=sheet.then(function(){return Promise.all([${loads}]);}).then(function(){return document.fonts.ready;}).then(${FIT_TEXT});})();</script>`
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

const ROOT_BACKGROUND: Record<Background, (tokens: BrandTokens) => string> = {
  [Background.Brand]: (tokens) => tokens.colors['brand.background'],
  [Background.Transparent]: () => 'transparent'
};

const BACKDROPS: ReadonlySet<ComponentId> = new Set(['BrandBackground']);

function withoutBackdrop(doc: MotionDoc): MotionDoc {
  if (doc.background !== Background.Transparent) {
    return doc;
  }
  return { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => !BACKDROPS.has(c.component as ComponentId)) })) };
}

function hotScript(script: string): string {
  return script.replace('<script>', HOT_SCRIPT).replace('<script type="module">', HOT_MODULE);
}

function zoomed(doc: MotionDoc, scale: number): string {
  return scale === 1 ? '' : `#root{width:${doc.width}px;height:${doc.height}px;zoom:${scale}}`;
}

export function composeHtml(raw: ComposeInput): string {
  const input = { ...raw, doc: bakePhysics(bakeExpressions(bakePaths(withoutBackdrop(flattenComps(withoutHidden(raw.doc)))), raw.analyses)) };
  const { doc, tokens } = input;
  const scale = raw.scale ?? 1;
  const frame = { width: Math.round(doc.width * scale), height: Math.round(doc.height * scale) };
  const bottomFirst = doc.tracks.map((track, index) => ({ track, index })).reverse();
  const layers: string[] = [];
  const tweens: Tween[] = [];
  const holds: Hold[] = [];
  const three: ThreeClip[] = [];
  const compositions: TimedBake[] = [];
  const shapes: ShapeBake[] = [];
  const particles: ParticleBake[] = [];
  const clips: MotionClip[] = [];
  const runs: CustomRun[] = [];
  const pairs = mattePairs(doc);
  const matteOf = new Map(pairs.map((p) => [p.target, p]));
  const hidden = new Set(pairs.map((p) => p.source));
  const effectSets: EffectSet[] = [];
  const starts = new Map<number, number>();
  const stage = doc.camera ? stageSpec(doc) : null;
  const onStage = new Set(stage?.layers.filter((l) => l.composite === Composite.World).map((l) => l.id));
  const startPose = new Map(stage ? cameraMath(sampleTrack).frameAt(stage, 0).layers.map((l) => [l.id, l.transform]) : []);
  const world: string[] = [];
  const byId = new Map(doc.tracks.flatMap((t) => t.clips as MotionClip[]).map((c) => [c.id, c]));
  const held = new Set(doc.motionBlur.enabled ? clipsOf(doc).filter((c) => !c.motionBlur).map((c) => c.id) : []);
  let layer = 0;

  for (const { track, index } of bottomFirst) {
    starts.set(index, layers.length);
    for (const clip of track.clips as MotionClip[]) {
      const ctx = ctxOf(clip, input);
      clips.push(clip);
      const template = TEMPLATES[clip.component] as (typeof TEMPLATES)[ComponentId];
      const group = GROUPS[clip.component];
      layer += 1;
      const placed: Placed = { layer, trackIndex: index, matte: matteOf.get(clip.id) ?? null, visibility: hidden.has(clip.id) ? Visibility.MatteSource : Visibility.Shown, transform: startPose.get(clip.id), chain: ancestorsOf(doc, clip.id).map((id) => byId.get(id)!), held: held.has(clip.id) };
      const html = group ? group.html(clip, ctx, placed, layers.splice(group.firstLayer(clip, index, starts)).join('')) : clipHtml(clip, ctx, placed, template.html(ctx as never));
      (onStage.has(clip.id) && !group && !hidden.has(clip.id) ? world : layers).push(html);
      effectSets.push(...(group ? group.effects(clip, ctx) : effectTimeline(clip, ctx, ctx.color)));
      const own = template.tweens?.(ctx as never) ?? [];
      tweens.push(...edgeTweens(clip, doc.fps), ...moveTweens(clip, doc.fps), ...own);
      holds.push(...heldUntilStart(own, ctx.start));
      if (THREE_D_COMPONENTS.includes(clip.component)) {
        three.push(threeClipOf(clip, ctx, onStage.has(clip.id), input));
      }
      if (clip.component === 'Composition') {
        compositions.push(compositionBake(clip, ctx));
      }
      const shape = clip.component === 'Shape' ? shapeBake({ ...clip, props: ctx.p as Record<string, unknown> }, ctx) : null;
      if (shape) {
        shapes.push(shape);
      }
      if (clip.component === 'Particles') {
        particles.push(particleBake(clip, ctx));
      }
      const run = clip.component === 'Custom' ? customRun(clip, ctx, doc.components) : null;
      if (run) {
        runs.push(run);
      }
    }
  }

  const duration = seconds(doc.durationInFrames, doc.fps);
  const background = ROOT_BACKGROUND[doc.background](tokens);
  const look = lookRuntime(doc.look);
  const outlines = three.some((c) => c.kind === ThreeKind.Text) ? [OPENTYPE_URL] : [];
  const animation = animationScript(clips, doc, (v) => resolveColor(v, tokens), parentsWithChildren(doc));
  const used = new Set(runs.map((r) => r.name));
  const libraries = librariesOf(doc.components, used);
  const threeCustom = libraries.has(Library.Three);
  const env = { assets: input.assets, brand: brandEnv(tokens) };
  const boot = gated(bootScript(runs, env, `window.__timelines[${js(COMPOSITION_ID)}]`));
  const definitions = [...used].map((name) => hotScript(definitionScript(name, doc.components[name].source.js))).join('');
  const customBoot = threeCustom
    ? `<script type="module">import * as THREE from 'three';window.${THREE_GLOBAL}=THREE;${boot}</script>`
    : boot
      ? `<script>${boot}</script>`
      : '';
  const scripts = [RUNTIME_URL, SCREENSHOT_URL, ...(three.length || compositions.length ? [THREE_BASE] : []), ...outlines, ...[...libraries].flatMap((lib) => LIBRARY_TAGS[lib].scripts)];
  const assetUrls = [...Object.values(input.assets), ...(tokens.logoUrl ? [tokens.logoUrl] : []), ...threeAssetUrls(look, three)];

  const page = [
    '<!doctype html><html lang="en"><head><meta charset="UTF-8" />',
    `<meta name="viewport" content="width=${frame.width}, height=${frame.height}" />`,
    cspMeta({ scripts: [...new Set(scripts)], assetUrls }),
    `<script src="${RUNTIME_URL}"></script>`,
    `<script>${engineScript()}</script>`,
    ...[...libraries].map((lib) => LIBRARY_TAGS[lib].tag),
    three.length || compositions.length || threeCustom ? threeImportMap() : '',
    `<link rel="stylesheet" crossorigin="anonymous" href="${FONTS_URL}" />`,
    fitScript(),
    hotRuntime(),
    fontLinks(doc, input.assets),
    `<style>${BASE_CSS}#root{background:${esc(background)}}${zoomed(doc, scale)}${stage ? STAGE_CSS : ''}</style>`,
    '</head><body>',
    `<div id="root" data-composition-id="${COMPOSITION_ID}" data-start="0" data-width="${frame.width}" data-height="${frame.height}" data-duration="${duration}" data-fps="${doc.fps}">`,
    HOT_OPEN,
    stage ? `<style>${stageRootStyle(stage)}</style><div id="world" class="world">${world.join('')}</div><!--/world-->` : '',
    layers.join(''),
    fontProbe(doc),
    HOT_CLOSE,
    '</div>',
    `${HOT_SCRIPT}${animation.setup}const tl=${ENGINE}.timeline();${holds.map(holdLine).join('')}${tweens.map(tweenLine).join('')}${animation.timeline}${effectScript(effectSets)}${held.size ? holdScript(doc.fps, doc.motionBlur) : ''}tl.set({}, {}, ${duration});window.__timelines=window.__timelines||{};window.__timelines[${js(COMPOSITION_ID)}]=tl;</script>`,
    hotScript(matteScript(pairs, Number(duration))),
    definitions,
    hotScript(customBoot),
    stage ? `${HOT_SCRIPT}${stageScript(stage, doc.fps, Number(duration))}</script>` : '',
    hotScript(threeScript(three, Number(duration), stage, look)),
    hotScript(compositionScript(compositions, Number(duration))),
    hotScript(shapeScript(shapes, doc.fps, Number(duration))),
    hotScript(particleScript(particles, doc.fps, Number(duration)))
  ].join('');
  return `${page}${captureScript(frame, contentStamp(page))}</body></html>`;
}
