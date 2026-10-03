import { THREE_D_COMPONENTS, type ComponentId } from '../components';
import { Ease, TransitionKind, type Edge } from '../design';
import { GSAP_EASE } from '../keyframes';
import type { MotionClip, MotionDoc } from '../doc';
import { resolveColor, type BrandTokens } from '../brand';
import { css, esc, js, seconds } from './html';
import { TEMPLATES, Timing, type PropsOf, type TemplateCtx, type Tween, type Vars } from './templates';
import { LIGHTING, threeImportMap, threeScript, type ThreeClip } from './three';
import { ANIMATE_CSS, animationScript, colourOverrides, sceneKeys, wrapAnimated } from './animate';
import { MASK_CSS, MaskScope, maskLayer, startValues } from './masks';
import { captureScript } from './capture';
import { hiddenMattes, matteMask, matteSource } from '../matte';
import { Matte, type Mask } from '../mask';

export { CAPTURE_REPLY, CAPTURE_REQUEST } from './capture';

export const HYPERFRAMES_VERSION = '0.8.114';
export const GSAP_VERSION = '3.14.2';
export const COMPOSITION_ID = 'main';

const RUNTIME_URL = `https://cdn.jsdelivr.net/npm/@hyperframes/core@${HYPERFRAMES_VERSION}/dist/hyperframe.runtime.iife.js`;
const GSAP_URL = `https://cdn.jsdelivr.net/npm/gsap@${GSAP_VERSION}/dist/gsap.min.js`;
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
    mediaStart: Number(seconds(clip.trimStart, doc.fps))
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

type Placed = { layer: number; trackIndex: number; matte: Mask | null; visibility: Visibility };

function clipHtml(clip: MotionClip, ctx: TemplateCtx<ComponentId>, placed: Placed): string {
  const template = TEMPLATES[clip.component] as (typeof TEMPLATES)[ComponentId];
  const inner = matted(clip, ctx, placed.matte, wrapAnimated(clip, ctx, ownMask(clip, ctx, template.html(ctx as never))));
  const fx = `<div class="fx" id="fx-${clip.id}">${inner}</div>`;
  const style = css({ zIndex: placed.layer });
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

function threeClipOf(clip: MotionClip, ctx: TemplateCtx<ComponentId>): ThreeClip {
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
    keys: sceneKeys(clip)
  };
}

const BASE_CSS = [
  'html,body{margin:0;padding:0;background:transparent}',
  '#root{position:relative;width:100%;height:100%;overflow:hidden}',
  '.layer{position:absolute;inset:0}',
  '.fx{position:absolute;inset:0;will-change:transform,opacity}',
  '.li{display:block;will-change:transform}',
  ANIMATE_CSS,
  MASK_CSS
].join('');

export function composeHtml(input: ComposeInput): string {
  const { doc, tokens } = input;
  const bottomFirst = doc.tracks.map((track, index) => ({ track, index })).reverse();
  const layers: string[] = [];
  const tweens: Tween[] = [];
  const holds: Hold[] = [];
  const three: ThreeClip[] = [];
  const clips: MotionClip[] = [];
  const hidden = hiddenMattes(doc);
  let layer = 0;

  for (const { track, index } of bottomFirst) {
    for (const clip of track.clips as MotionClip[]) {
      const ctx = ctxOf(clip, input);
      clips.push(clip);
      const template = TEMPLATES[clip.component] as (typeof TEMPLATES)[ComponentId];
      layer += 1;
      layers.push(clipHtml(clip, ctx, { layer, trackIndex: index, matte: matteOf(doc, clip), visibility: hidden.has(clip.id) ? Visibility.MatteSource : Visibility.Shown }));
      const own = template.tweens?.(ctx as never) ?? [];
      tweens.push(...edgeTweens(clip, doc.fps), ...moveTweens(clip, doc.fps), ...own);
      holds.push(...heldUntilStart(own, ctx.start));
      if (THREE_D_COMPONENTS.includes(clip.component)) {
        three.push(threeClipOf(clip, ctx));
      }
    }
  }

  const duration = seconds(doc.durationInFrames, doc.fps);
  const background = tokens.colors['brand.background'];
  const animation = animationScript(clips, doc, (v) => resolveColor(v, tokens));

  return [
    '<!doctype html><html lang="en"><head><meta charset="UTF-8" />',
    `<meta name="viewport" content="width=${doc.width}, height=${doc.height}" />`,
    `<script src="${RUNTIME_URL}"></script>`,
    `<script src="${GSAP_URL}"></script>`,
    three.length ? threeImportMap() : '',
    `<link rel="stylesheet" crossorigin="anonymous" href="${FONTS_URL}" />`,
    `<style>${BASE_CSS}#root{background:${esc(background)}}</style>`,
    '</head><body>',
    `<div id="root" data-composition-id="${COMPOSITION_ID}" data-start="0" data-width="${doc.width}" data-height="${doc.height}" data-duration="${duration}" data-fps="${doc.fps}">`,
    layers.join(''),
    '</div>',
    `<script>${animation.setup}const tl=gsap.timeline({paused:true});${holds.map(holdLine).join('')}${tweens.map(tweenLine).join('')}${animation.timeline}tl.set({}, {}, ${duration});window.__timelines=window.__timelines||{};window.__timelines[${js(COMPOSITION_ID)}]=tl;</script>`,
    threeScript(three, Number(duration)),
    captureScript(doc),
    '</body></html>'
  ].join('');
}
