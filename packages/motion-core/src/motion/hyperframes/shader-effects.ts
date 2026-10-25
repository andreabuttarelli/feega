import type { MotionClip } from '../doc';
import { sampleColor, sampleTrack } from '../keyframes';
import { SHADER_EFFECTS, ShaderPlay, animatedKeys, type ShaderEffectId } from '../shader-effects/catalogue';
import { effectValues, type ShaderValues } from '../shader-effects/preset';
import { SHADERS_GLOBAL } from '../libs/catalog';
import { css, js } from './html';
import { seekDriver } from './stage';
import { ON_DISPOSE, hotScope, hotSeek } from './hot';

type Env = { width: number; height: number; fps: number; color: (value: string) => string; asset: (id: string | null) => string | null };

export type ShaderEffectBake = { id: string; from: number; effect: ShaderEffectId; image: string | null; width: number; height: number; base: ShaderValues; rows: ShaderValues[]; live: boolean; fallback: string[] };

const SHADER_EFFECT_TIMELINE = 'feegaShaderEffects';
const READY_KEY = 'motion-shader-effects';
const IMAGE_WAIT_MS = 4000;
const IMAGE_POLL_MS = 50;

export const shaderCanvasId = (clipId: string) => `sx-${clipId}`;

function rowAt(clip: MotionClip, keys: readonly string[], color: Env['color'], frame: number): ShaderValues {
  return Object.fromEntries(keys.map((key) => [key, typeof clip.keyframes[key][0].value === 'number' ? sampleTrack(clip.keyframes[key], frame) : sampleColor(clip.keyframes[key], frame, color)]));
}

export function shaderEffectBake(clip: MotionClip, env: Env, live: boolean): ShaderEffectBake {
  const effect = clip.props.effect as ShaderEffectId;
  const spec = SHADER_EFFECTS[effect];
  const values = effectValues(effect, clip.props as ShaderValues);
  const base = Object.fromEntries(Object.entries(values).map(([key, v]) => [key, key in spec.colours ? env.color(String(v)) : v]));
  const keyed = animatedKeys(spec).filter((key) => clip.keyframes[key]?.length);
  const rows = keyed.length ? Array.from({ length: clip.durationInFrames }, (_, f) => rowAt(clip, keyed, env.color, f)) : [];
  return { id: clip.id, from: clip.from, effect, image: env.asset((clip.props.image as string | null) ?? null), width: Math.round(env.width), height: Math.round(env.height), base, rows, live: live && spec.play === ShaderPlay.Live, fallback: Object.keys(spec.colours).map((key) => String(base[key])).filter((c) => c.startsWith('#')) };
}

export function shaderEffectHtml(clipId: string, width: number, height: number): string {
  const fill = css({ position: 'absolute', left: '0', top: '0', width: '100%', height: '100%' });
  return `<div class="cc"><canvas id="${shaderCanvasId(clipId)}" width="${Math.round(width)}" height="${Math.round(height)}" style="${fill}"></canvas></div>`;
}

export function shaderEffectScript(bakes: readonly ShaderEffectBake[], fps: number, duration: number): string {
  if (!bakes.length) {
    return '';
  }
  return `<script>(function(){${hotScope(SHADER_EFFECT_TIMELINE)}const S=window.${SHADERS_GLOBAL};const B=${js(bakes)};
let shown=0;
function fallback(it){const g=it.paint.createLinearGradient(0,0,it.out.width,it.out.height);const c=it.b.fallback;g.addColorStop(0,c[0]||'#111111');g.addColorStop(1,c[1]||c[0]||'#333333');it.paint.fillStyle=g;it.paint.fillRect(0,0,it.out.width,it.out.height);}
function valuesAt(it,frame){const rows=it.b.rows;if(!rows.length){return it.b.base;}return Object.assign({},it.b.base,rows[Math.max(0,Math.min(rows.length-1,Math.round(frame)))]);}
function draw(it,time){
  if(!it.shader||it.shader.failure()){if(it.paint){fallback(it);}return;}
  const frame=time*${fps}-it.b.from;
  it.shader.seek(Math.max(0,frame/${fps}),S.props(S.effects[it.b.effect],valuesAt(it,frame)));
  it.paint.clearRect(0,0,it.out.width,it.out.height);
  it.paint.drawImage(it.gpu,0,0,it.out.width,it.out.height);
}
function shaderEffectsNow(time){
  shown=time;
  items.forEach(function(it){if(!it.b.live){draw(it,time);}});
  requestAnimationFrame(function(){if(shown===time){items.forEach(function(it){if(!it.b.live){draw(it,time);}});}});
}
function blank(it){const d=it.paint.getImageData(0,0,it.out.width,it.out.height).data;for(let i=3;i<d.length;i+=4096){if(d[i]){return false;}}return true;}
function settle(it){if(!it.b.image){return Promise.resolve();}const until=Date.now()+${IMAGE_WAIT_MS};return new Promise(function(done){(function poll(){draw(it,shown);if(!blank(it)||Date.now()>until){done();return;}setTimeout(poll,${IMAGE_POLL_MS});})();});}
const items=B.map(function(b){const out=document.getElementById(${js(shaderCanvasId(''))}+b.id);return {b:b,out:out,paint:out&&out.getContext('2d',{willReadFrequently:true}),gpu:null,shader:null};});
const mounted=Promise.all(items.map(function(it){
  if(!it.out){return null;}
  if(!S){fallback(it);return null;}
  it.gpu=it.b.live?it.out.cloneNode():document.createElement('canvas');
  if(!it.b.live){it.gpu.width=it.b.width;it.gpu.height=it.b.height;}
  return S.supported().then(function(ok){
    if(!ok){fallback(it);return null;}
    if(it.b.live){it.out.replaceWith(it.gpu);}
    return S.mount(it.gpu,S.tree(it.b.effect,it.b.base,it.b.image),{width:it.b.width,height:it.b.height}).then(function(shader){
      it.shader=shader;
      if(it.b.live){shader.play();return null;}
      return settle(it);
    });
  }).catch(function(){fallback(it);});
}));
window.__hf=window.__hf||{};window.__hf.buildReady=window.__hf.buildReady||{};
window.__hf.buildReady[${js(READY_KEY)}]=mounted.then(function(){shaderEffectsNow(shown);});
const tl=window.__timelines&&window.__timelines.main;
${seekDriver(SHADER_EFFECT_TIMELINE, duration, 'shaderEffectsNow')}
${hotSeek('shaderEffectsNow')}
${ON_DISPOSE}(function(){items.forEach(function(it){if(it.shader){it.shader.destroy();}});});
})();</script>`;
}
