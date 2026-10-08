import type { EffectSet } from '../effects/render';
import type { Keyframe } from '../keyframes';
import { LENS_MAP_SIZE, lensMapUrl } from '../glass/lens-map';
import { glassPose } from '../glass/pose';
import type { GlassPose } from '../glass/shape';
import { css, esc } from './html';

export const glassIds = {
  layer: (id: string) => `lg-${id}`,
  filter: (id: string) => `lgf-${id}`,
  map: (id: string) => `lgm-${id}`,
  smooth: (id: string) => `lgn-${id}`,
  bend: (id: string) => `lgd-${id}`,
  frost: (id: string) => `lgb-${id}`,
  cut: (id: string) => `lgk-${id}`,
  chrome: (id: string) => `lgs-${id}`,
  body: (id: string) => `lgc-${id}`,
  rim: (id: string) => `lgr-${id}`,
  shine: (id: string) => `lgh-${id}`,
  shade: (id: string) => `lgo-${id}`
};

export const RIM_STOPS = [
  [0, 0.45],
  [20, 0.15],
  [40, 0],
  [60, 0],
  [80, 0.15],
  [100, 0.45]
] as const;

const UNIT = 100;
const EDGE_PAD = 2;
const SMOOTH_TEXELS = 3;
const PRECISION = 100;
const HALF_FRAME = 0.5;
const TIME_PRECISION = 10000;
const INSET_LIGHT = 0.1;
const INSET_DROP = 0.6;
const LENS_OFF = 'none';

type GlassClip = { id: string; from: number; durationInFrames: number; props: Record<string, unknown>; keyframes: Record<string, Keyframe[] | undefined> };
export type GlassFrame = { width: number; height: number; fps: number; color: (v: string) => string };

const round = (n: number) => Math.round(n * PRECISION) / PRECISION;
const setTime = (frame: number, fps: number) => Math.round(((frame - HALF_FRAME) / fps) * TIME_PRECISION) / TIME_PRECISION;
const lensOn = (id: string) => `url(#${glassIds.filter(id)})`;

type Attrs = Record<string, string | number>;

function region(p: GlassPose): Attrs {
  return { x: round(p.cx - p.rx - EDGE_PAD), y: round(p.cy - p.ry - EDGE_PAD), width: round(2 * (p.rx + EDGE_PAD)), height: round(2 * (p.ry + EDGE_PAD)) };
}

function poseAttrs(id: string, p: GlassPose): Map<string, Attrs> {
  const box = region(p);
  const texel = (2 * SMOOTH_TEXELS) / LENS_MAP_SIZE;
  return new Map<string, Attrs>([
    [glassIds.map(id), { x: round(p.cx - p.rx), y: round(p.cy - p.ry), width: round(2 * p.rx), height: round(2 * p.ry) }],
    [glassIds.smooth(id), { ...box, stdDeviation: `${round(texel * p.rx)} ${round(texel * p.ry)}` }],
    [glassIds.bend(id), { ...box, scale: round(p.bend) }],
    [glassIds.frost(id), { ...box, stdDeviation: round(p.frost) }],
    [glassIds.cut(id), box],
    [glassIds.body(id), { transform: `translate(${round(p.cx)} ${round(p.cy)}) scale(${round(p.rx / UNIT)} ${round(p.ry / UNIT)})`, opacity: round(p.alpha) }]
  ]);
}

const attrText = (a: Attrs) =>
  Object.entries(a)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ');

function lensFilter(id: string, frame: GlassFrame, a: Map<string, Attrs>): string {
  const at = (key: (id: string) => string) => attrText(a.get(key(id))!);
  return [
    `<filter id="${glassIds.filter(id)}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" x="0" y="0" width="${frame.width}" height="${frame.height}" color-interpolation-filters="sRGB">`,
    `<feImage id="${glassIds.map(id)}" href="${lensMapUrl()}" preserveAspectRatio="none" ${at(glassIds.map)} result="map"/>`,
    `<feGaussianBlur id="${glassIds.smooth(id)}" in="map" ${at(glassIds.smooth)} result="smooth"/>`,
    `<feDisplacementMap id="${glassIds.bend(id)}" in="SourceGraphic" in2="smooth" xChannelSelector="R" yChannelSelector="G" ${at(glassIds.bend)} result="bent"/>`,
    `<feGaussianBlur id="${glassIds.frost(id)}" in="bent" ${at(glassIds.frost)} result="soft"/>`,
    `<feComposite id="${glassIds.cut(id)}" in="soft" in2="map" operator="in" ${at(glassIds.cut)} result="lens"/>`,
    '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="lens"/></feMerge>',
    '</filter>'
  ].join('');
}

function chrome(id: string, frame: GlassFrame, p: GlassPose, a: Map<string, Attrs>, shown: boolean): string {
  const stops = RIM_STOPS.map(([at, o]) => `<stop offset="${at}%" stop-color="#ffffff" stop-opacity="${o}"/>`).join('');
  const defs = [
    `<linearGradient id="${glassIds.rim(id)}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`,
    `<radialGradient id="${glassIds.shine(id)}"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.4"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`,
    `<radialGradient id="${glassIds.shade(id)}"><stop offset="86%" stop-color="#000000" stop-opacity="0"/><stop offset="93%" stop-color="#000000" stop-opacity="0.2"/><stop offset="100%" stop-color="#000000" stop-opacity="0"/></radialGradient>`
  ].join('');
  const flat = 'vector-effect="non-scaling-stroke" fill="none"';
  const body = [
    `<circle r="${UNIT}" transform="translate(0 6) scale(1.1)" fill="url(#${glassIds.shade(id)})"/>`,
    `<circle r="${UNIT}" fill="${esc(p.tint)}" fill-opacity="${p.tintAmount}"/>`,
    `<circle r="${UNIT}" transform="translate(0 ${INSET_DROP})" ${flat} stroke="#ffffff" stroke-opacity="${INSET_LIGHT}" stroke-width="1"/>`,
    `<circle r="${UNIT}" ${flat} stroke="url(#${glassIds.rim(id)})" stroke-width="${p.rim}"/>`,
    `<circle r="${UNIT}" transform="translate(-36 -50) rotate(-32) scale(0.44 0.16)" fill="url(#${glassIds.shine(id)})"/>`,
    `<circle r="${UNIT}" transform="translate(-55 -36) scale(0.07)" fill="url(#${glassIds.shine(id)})"/>`,
    `<circle r="${UNIT}" transform="translate(32 64) rotate(-28) scale(0.42 0.08)" fill="url(#${glassIds.shine(id)})" opacity="0.25"/>`
  ].join('');
  const style = css({ position: 'absolute', left: '0', top: '0', pointerEvents: 'none', overflow: 'visible', visibility: shown ? 'visible' : 'hidden' });
  return `<svg id="${glassIds.chrome(id)}" width="${frame.width}" height="${frame.height}" viewBox="0 0 ${frame.width} ${frame.height}" aria-hidden="true" style="${style}"><defs>${defs}</defs><g id="${glassIds.body(id)}" ${attrText(a.get(glassIds.body(id))!)}>${body}</g></svg>`;
}

export function glassLayer(clip: GlassClip, frame: GlassFrame, inner: string, zIndex: number): string {
  const pose = glassPose(clip, 0, frame, frame.color);
  const a = poseAttrs(clip.id, pose);
  const shown = clip.from === 0;
  const defs = `<svg class="efd" aria-hidden="true"><defs>${lensFilter(clip.id, frame, a)}</defs></svg>`;
  const lens = `<div class="ef" id="${glassIds.layer(clip.id)}" data-clip="${esc(clip.id)}" data-group="${esc(clip.id)}" style="z-index:${zIndex};filter:${shown ? lensOn(clip.id) : LENS_OFF}">${defs}${inner}</div>`;
  const over = `<div class="ef" style="z-index:${zIndex};pointer-events:none">${chrome(clip.id, frame, pose, a, shown)}</div>`;
  return `${lens}${over}<!--/group:${esc(clip.id)}-->`;
}

function poseSets(clip: GlassClip, frame: GlassFrame): EffectSet[] {
  const sets: EffectSet[] = [];
  let previous = poseAttrs(clip.id, glassPose(clip, 0, frame, frame.color));
  for (let local = 1; local < clip.durationInFrames; local++) {
    const next = poseAttrs(clip.id, glassPose(clip, local, frame, frame.color));
    const at = setTime(clip.from + local, frame.fps);
    for (const [target, attrs] of next) {
      const before = previous.get(target) ?? {};
      const changed = Object.fromEntries(Object.entries(attrs).filter(([k, v]) => before[k] !== v));
      if (Object.keys(changed).length) {
        sets.push({ target: `#${target}`, vars: { attr: changed }, at });
      }
    }
    previous = next;
  }
  return sets;
}

export function glassTimeline(clip: GlassClip, frame: GlassFrame): EffectSet[] {
  const lens = `#${glassIds.layer(clip.id)}`;
  const over = `#${glassIds.chrome(clip.id)}`;
  const start = setTime(clip.from, frame.fps);
  const end = setTime(clip.from + clip.durationInFrames, frame.fps);
  const enter = clip.from > 0 ? [{ target: lens, vars: { filter: lensOn(clip.id) }, at: start }, { target: over, vars: { visibility: 'visible' }, at: start }] : [];
  return [...enter, ...poseSets(clip, frame), { target: lens, vars: { filter: LENS_OFF }, at: end }, { target: over, vars: { visibility: 'hidden' }, at: end }];
}
