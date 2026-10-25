import { engineScript } from '../engine/engine';
import { particleRuntime } from './particles';
import { MOTION_RUNTIME_ROUTE, PARTICLE_RUNTIME_GLOBAL } from './runtime-delivery';
import liveRuntime from 'virtual:motion-live-runtime';
import generative from 'virtual:motion-generative';
import twgl from 'virtual:motion-twgl';
import fx from 'virtual:motion-fx';
import splitting from 'virtual:motion-splitting';
import openProps from 'virtual:motion-open-props';
import shaderRuntime from 'virtual:motion-shader-fx';

export enum Chunk {
  Engine = 'engine',
  Live = 'live',
  Shader = 'shader',
  Particles = 'particles',
  Generative = 'generative',
  Twgl = 'twgl',
  Fx = 'fx',
  Splitting = 'splitting',
  OpenProps = 'open-props'
}

const SOURCES: Record<Chunk, () => string> = {
  [Chunk.Engine]: engineScript,
  [Chunk.Live]: () => liveRuntime,
  [Chunk.Shader]: () => shaderRuntime,
  [Chunk.Particles]: () => `window.${PARTICLE_RUNTIME_GLOBAL}=${particleRuntime()};`,
  [Chunk.Generative]: () => generative,
  [Chunk.Twgl]: () => twgl,
  [Chunk.Fx]: () => fx,
  [Chunk.Splitting]: () => splitting,
  [Chunk.OpenProps]: () => openProps
};

const HASH_SEED_A = 0xdeadbeef;
const HASH_SEED_B = 0x41c6ce57;

function contentHash(text: string): string {
  let a = HASH_SEED_A;
  let b = HASH_SEED_B;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 2654435761);
    b = Math.imul(b ^ c, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (b >>> 0).toString(16).padStart(8, '0') + (a >>> 0).toString(16).padStart(8, '0');
}

type Built = { code: string; file: string };

let built: Map<Chunk, Built> | null = null;

function chunks(): Map<Chunk, Built> {
  built ??= new Map(
    Object.values(Chunk).map((chunk) => {
      const code = SOURCES[chunk]();
      return [chunk, { code, file: `${chunk}.${contentHash(code)}.js` }];
    })
  );
  return built;
}

export const chunkCode = (chunk: Chunk) => chunks().get(chunk)!.code;

export const chunkUrl = (origin: string, chunk: Chunk) => `${origin}${MOTION_RUNTIME_ROUTE}/${chunks().get(chunk)!.file}`;

export function chunkByFile(file: string): string | null {
  return [...chunks().values()].find((c) => c.file === file)?.code ?? null;
}
