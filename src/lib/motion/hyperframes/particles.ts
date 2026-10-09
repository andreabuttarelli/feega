import type { MotionClip } from '../doc';
import { sampleColor, sampleTrack } from '../keyframes';
import { PARTICLE_COLOUR_KEYS, PARTICLE_NUMBER_KEYS, ParticleShape, type Emitter } from '../particles/model';
import { drawParticles, glowTiles, particleQuads, particlesAt, type ParticleBake, type ParticleRow, type Rgb } from '../particles/simulate';
import { css, esc, js } from './html';
import { seekDriver } from './stage';
import { ON_DISPOSE, hotScope, hotSeek } from './hot';

type Env = { width: number; height: number; unit: number; fps: number; color: (value: string) => string };

const PARTICLE_TIMELINE = 'feegaParticles';
const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const WHITE: Rgb = [255, 255, 255];

export const PARTICLE_STATE = 'feegaParticles';

export const canvasId = (clipId: string) => `pt-${clipId}`;
export const spriteId = (clipId: string) => `pts-${clipId}`;

function rgbOf(hex: string): Rgb {
  const m = HEX.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : WHITE;
}

const isKeyed = (clip: MotionClip) => [...PARTICLE_NUMBER_KEYS, ...PARTICLE_COLOUR_KEYS].some((key) => clip.keyframes[key]?.length);

function rowAt(clip: MotionClip, env: Env, frame: number): ParticleRow {
  const p = clip.props as Record<string, number | string>;
  const numbers = Object.fromEntries(PARTICLE_NUMBER_KEYS.map((key) => [key, clip.keyframes[key]?.length ? sampleTrack(clip.keyframes[key], frame) : Number(p[key])]));
  const colour = (key: (typeof PARTICLE_COLOUR_KEYS)[number]) => rgbOf(clip.keyframes[key]?.length ? sampleColor(clip.keyframes[key], frame, env.color) : env.color(String(p[key])));
  return { ...(numbers as Record<(typeof PARTICLE_NUMBER_KEYS)[number], number>), start: colour('colorStart'), end: colour('colorEnd') };
}

export function particleBake(clip: MotionClip, env: Env): ParticleBake {
  const p = clip.props as { seed: number; emitter: Emitter; shape: ParticleShape; prewarm: boolean };
  const frames = isKeyed(clip) ? clip.durationInFrames : 1;
  return {
    id: clip.id,
    from: clip.from,
    fps: env.fps,
    width: env.width,
    height: env.height,
    unit: env.unit,
    seed: p.seed,
    emitter: p.emitter,
    shape: p.shape,
    prewarm: p.prewarm,
    rows: Array.from({ length: frames }, (_, f) => rowAt(clip, env, f))
  };
}

export function particleHtml(clipId: string, width: number, height: number, sprite: string | null): string {
  const fill = css({ position: 'absolute', left: '0', top: '0', width: '100%', height: '100%' });
  const image = sprite ? `<img id="${spriteId(clipId)}" src="${esc(sprite)}" crossorigin="anonymous" alt="" style="display:none" />` : '';
  return `<div class="cc"><canvas id="${canvasId(clipId)}" width="${width}" height="${height}" style="${fill}"></canvas>${image}</div>`;
}

export function particleScript(bakes: readonly ParticleBake[], fps: number, duration: number): string {
  if (!bakes.length) {
    return '';
  }
  return `<script>(function(){${hotScope(PARTICLE_TIMELINE)}const PT_AT=(${particlesAt.toString()});const PT_DRAW=(${drawParticles.toString()});const PT_GLOWS=(${glowTiles.toString()})(function(){return document.createElement('canvas');});const PT_QUADS=(${particleQuads.toString()});
const B=${js(bakes)};
const items=B.map(function(b){const el=document.getElementById(${js(canvasId(''))}+b.id);return {b:b,el:el,memo:new Map(),paint:el&&el.getContext('2d'),sprite:document.getElementById(${js(spriteId(''))}+b.id)};});
let shown=0;
function particlesNow(time){
  shown=time;
  items.forEach(function(it){
    if(!it.paint){return;}
    const sprite=it.sprite&&it.sprite.complete&&it.sprite.naturalWidth?it.sprite:null;
    const list=PT_AT(it.b,time*${fps}-it.b.from,it.memo);
    PT_DRAW(it.paint,list,it.b.shape,sprite,PT_GLOWS);
    if(it.b.shape!==${js(ParticleShape.Sprite)}){it.el[${js(PARTICLE_STATE)}]=function(){return {shape:it.b.shape,quads:PT_QUADS(list)};};}
  });
}
items.forEach(function(it){if(it.sprite){it.sprite.addEventListener('load',function(){particlesNow(shown);});}});
const tl=window.__timelines&&window.__timelines.main;
${seekDriver(PARTICLE_TIMELINE, duration, 'particlesNow')}
${hotSeek('particlesNow')}
${ON_DISPOSE}(function(){items.forEach(function(it){if(it.paint){it.paint.clearRect(0,0,it.paint.canvas.width,it.paint.canvas.height);}});});
particlesNow(0);
})();</script>`;
}
