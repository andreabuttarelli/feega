import type { MotionClip } from '../doc';
import { Source, animProp, sampleTrack } from '../keyframes';
import type { Size } from '../shape/geometry';
import { movesOverTime } from '../shape/modifiers';
import { shapeMarkup, type ShapeLook } from '../shape/render';
import { modifierOfKey, modifierValues, type Modifier } from '../shape/schema';
import { js } from './html';
import { seekDriver } from './stage';
import { hotScope, hotSeek } from './hot';

export type ShapeBake = { id: string; from: number; index: number[]; frames: string[] };
type Env = { width: number; height: number; unit: number; fps: number; color: (value: string) => string };

const SHAPE_TIMELINE = 'feegaShapes';
const svgId = (id: string) => `sv-${id}`;

const isGeometric = (key: string) => modifierOfKey(key) !== null || animProp('Shape', key)?.source === Source.Param;

const runsByItself = (m: Modifier) => m.enabled && movesOverTime({ kind: m.kind, values: modifierValues(m) });

function lookAt(clip: MotionClip, frame: number): ShapeLook {
  const look = { ...(clip.props as unknown as ShapeLook) };
  const params = new Map<string, Record<string, number>>();
  for (const [key, track] of Object.entries(clip.keyframes)) {
    if (!track.length || !isGeometric(key)) {
      continue;
    }
    const value = sampleTrack(track, frame);
    const ref = modifierOfKey(key);
    if (!ref) {
      (look as unknown as Record<string, number>)[key] = value;
      continue;
    }
    params.set(ref.id, { ...params.get(ref.id), [ref.param]: value });
  }
  look.modifiers = look.modifiers.map((m) => ({ ...m, params: { ...m.params, ...params.get(m.id) } }));
  return look;
}

function sizeOf(clip: MotionClip, env: Env): Size {
  const p = clip.props as { width: number; height: number };
  return { w: p.width * env.width, h: p.height * env.height };
}

function markupAt(id: string, env: Env, frame: number, size: Size, look: ShapeLook): string {
  return shapeMarkup(look, { id, size, unit: env.unit, time: frame / env.fps, color: env.color });
}

export function shapeHtml(id: string, look: ShapeLook, env: Env, size: Size): string {
  const w = Math.round(size.w * 100) / 100;
  const h = Math.round(size.h * 100) / 100;
  return `<svg id="${svgId(id)}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible">${markupAt(id, env, 0, size, look)}</svg>`;
}

export function shapeBake(clip: MotionClip, env: Env): ShapeBake | null {
  const modifiers = (clip.props.modifiers as Modifier[] | undefined) ?? [];
  const moving = Object.keys(clip.keyframes).some(isGeometric) || modifiers.some(runsByItself);
  if (!moving) {
    return null;
  }
  const size = sizeOf(clip, env);
  const frames: string[] = [];
  const seen = new Map<string, number>();
  const index = Array.from({ length: clip.durationInFrames }, (_, f) => {
    const markup = markupAt(clip.id, env, f, size, lookAt(clip, f));
    if (!seen.has(markup)) {
      seen.set(markup, frames.length);
      frames.push(markup);
    }
    return seen.get(markup)!;
  });
  return { id: clip.id, from: clip.from, index, frames };
}

export function shapeScript(bakes: readonly ShapeBake[], fps: number, duration: number): string {
  if (!bakes.length) {
    return '';
  }
  return `<script>(function(){${hotScope(SHAPE_TIMELINE)}const S=${js(bakes)};
const els=S.map(function(s){return document.getElementById('${svgId('')}'+s.id);});
function shapesAt(time){
  S.forEach(function(s,i){
    const el=els[i];
    if(!el){return;}
    const f=Math.min(Math.max(Math.floor(time*${fps}+1e-6)-s.from,0),s.index.length-1);
    const k=s.index[f];
    if(el.__shapeFrame!==k){el.__shapeFrame=k;el.innerHTML=s.frames[k];}
  });
}
const tl=window.__timelines&&window.__timelines.main;
${seekDriver(SHAPE_TIMELINE, duration, 'shapesAt')}
${hotSeek('shapesAt')}
shapesAt(0);
})();</script>`;
}
