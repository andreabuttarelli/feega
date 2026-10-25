import { sampleColor, sampleTrack } from '../keyframes';
import { effectKey } from '../effects/model';
import { hotScope, hotSeek, ON_DISPOSE } from '../hyperframes/hot';
import { seekDriver } from '../hyperframes/stage';
import { shaderValues, type ClipShader, type ShaderDefs } from './model';

type Clip = { id: string; durationInFrames: number; keyframes: Record<string, { frame: number; value: number | string }[]>; shaders: ClipShader[] };

type Timing = { start: number; fps: number; color: (value: string) => string };

export type ShaderBake = {
  clipId: string;
  start: number;
  frames: number;
  fps: number;
  frag: string;
  params: ShaderDefs[string]['params'];
  values: Record<string, number | string | (number | string)[]>;
  seed: number;
};

const SEED_KIND = 'seed';

function track(clip: Clip, shader: ClipShader, key: string) {
  const keys = clip.keyframes[effectKey(shader.id, key)];
  return keys?.length ? keys : null;
}

export function shaderBakes(clip: Clip, doc: { shaders: ShaderDefs }, timing: Timing): ShaderBake[] {
  return clip.shaders
    .filter((s) => s.enabled && doc.shaders[s.ref])
    .map((shader) => {
      const def = doc.shaders[shader.ref];
      const base = shaderValues(shader, def);
      const frames = Array.from({ length: clip.durationInFrames }, (_, f) => f);
      const values = Object.fromEntries(
        def.params.map((p) => {
          const keys = track(clip, shader, p.key);
          if (!keys) {
            return [p.key, p.kind === 'color' ? timing.color(String(base[p.key])) : base[p.key]];
          }

          const sample = (f: number) => (p.kind === 'color' ? sampleColor(keys as never, f, timing.color) : sampleTrack(keys as never, f));
          return [p.key, frames.map(sample)];
        })
      );
      const seedParam = def.params.find((p) => p.kind === SEED_KIND);
      return { clipId: clip.id, start: timing.start, frames: clip.durationInFrames, fps: timing.fps, frag: def.frag, params: def.params, values, seed: seedParam ? Number(base[seedParam.key]) : 0 };
    });
}

const SHADER_TIMELINE = 'shader-clips';

const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export function shaderScript(bakes: ShaderBake[], duration: number): string {
  if (!bakes.length) {
    return '';
  }

  return `<script>(function(){${hotScope(SHADER_TIMELINE)}const draw=window.__shaderClips(${json(bakes)},${ON_DISPOSE});const tl=window.__timelines&&window.__timelines.main;${seekDriver(SHADER_TIMELINE, duration, 'draw')}${hotSeek('draw')}draw(0);})();</script>`;
}
