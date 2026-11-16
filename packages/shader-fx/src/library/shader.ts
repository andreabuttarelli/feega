import type { EffectInput, ShaderParam } from '../effect';

export enum LibraryGenre {
  Gradient = 'gradient',
  Glass = 'glass',
  Field = 'field',
  Orb = 'orb',
  Transition = 'transition'
}

export type LibraryShader = EffectInput & { genre: LibraryGenre; description: string };

export const num = (key: string, label: string, min: number, max: number, step: number, value: number): ShaderParam => ({ key, label, kind: 'number', min, max, step, default: value });

export const colour = (key: string, label: string, value: string): ShaderParam => ({ key, label, kind: 'color', default: value });
