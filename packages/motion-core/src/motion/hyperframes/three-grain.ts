import type { Keyframes } from '../keyframes';
import { EFFECTS, EffectKind } from '../effects/registry';
import { effectKey, paramValues, type Effect } from '../effects/model';

export type ThreeGrain = { amount: number; size: number; evolve: number };

export const GRAIN_TILE = 256;

export function grainTile(size: number, seed: number): Uint8Array {
  const TILE = 256;
  const COVER = 0.2;
  const LUMA = [0.213, 0.715, 0.072];
  const period = Math.max(1, Math.round(TILE / size));
  const wrap = (n: number) => ((n % period) + period) % period;
  const angle = (x: number, y: number, channel: number) => {
    let h = Math.imul(wrap(x), 374761393) ^ Math.imul(wrap(y), 668265263) ^ Math.imul(channel + 1, 2246822519) ^ Math.imul(seed + 1, 3266489917);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return ((h >>> 0) / 4294967296) * Math.PI * 2;
  };
  const corner = (x: number, y: number, channel: number, dx: number, dy: number) => {
    const a = angle(x, y, channel);
    return Math.cos(a) * dx + Math.sin(a) * dy;
  };
  const fade = (t: number) => t * t * (3 - 2 * t);
  const perlin = (u: number, v: number, channel: number) => {
    const x = Math.floor(u);
    const y = Math.floor(v);
    const fx = u - x;
    const fy = v - y;
    const top = corner(x, y, channel, fx, fy) + (corner(x + 1, y, channel, fx - 1, fy) - corner(x, y, channel, fx, fy)) * fade(fx);
    const bottom = corner(x, y + 1, channel, fx, fy - 1) + (corner(x + 1, y + 1, channel, fx - 1, fy - 1) - corner(x, y + 1, channel, fx, fy - 1)) * fade(fx);
    return top + (bottom - top) * fade(fy);
  };

  const out = new Uint8Array(TILE * TILE);
  for (let py = 0; py < TILE; py++) {
    for (let px = 0; px < TILE; px++) {
      const u = ((px + 0.5) * period) / TILE;
      const v = ((py + 0.5) * period) / TILE;
      const gray = 0.5 + 0.5 * LUMA.reduce((sum, w, channel) => sum + w * perlin(u, v, channel), 0);
      const cover = 1 - COVER + COVER * (0.5 + 0.5 * perlin(u, v, LUMA.length));
      out[py * TILE + px] = Math.round(Math.min(1, Math.max(0, gray * cover)) * 255);
    }
  }
  return out;
}

type GrainedClip = { effects: Effect[]; keyframes: Keyframes };

const keyed = (clip: GrainedClip, effect: Effect) => EFFECTS[effect.kind].params.some((p) => clip.keyframes[effectKey(effect.id, p.key)]?.length);

const paintable = (clip: GrainedClip, effect: Effect) => effect.kind === EffectKind.Noise && !keyed(clip, effect);

function leadingGrains(clip: GrainedClip): Effect[] {
  const shown = clip.effects.filter((e) => e.enabled);
  const firstOther = shown.findIndex((e) => !paintable(clip, e));
  return firstOther === -1 ? shown : shown.slice(0, firstOther);
}

export function threeGrains(clip: GrainedClip): ThreeGrain[] {
  return leadingGrains(clip).map((effect) => {
    const v = paramValues(effect);
    return { amount: Number(v.amount), size: Number(v.size), evolve: Number(v.evolve) };
  });
}

export function withoutGrain<C extends GrainedClip>(clip: C): C {
  const painted = new Set(leadingGrains(clip));
  return painted.size ? { ...clip, effects: clip.effects.filter((e) => !painted.has(e)) } : clip;
}
