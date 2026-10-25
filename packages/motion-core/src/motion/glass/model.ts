export enum GlassSection {
  Layout = 'layout',
  Look = 'look',
  Motion = 'motion'
}

export type GlassNumber = { label: string; min: number; max: number; step: number; fallback: number; section: GlassSection };

const n = (label: string, min: number, max: number, step: number, fallback: number, section: GlassSection): GlassNumber => ({ label, min, max, step, fallback, section });

export const GLASS_NUMBERS = {
  centerX: n('Centre X', -0.5, 1.5, 0.001, 0.5, GlassSection.Layout),
  centerY: n('Centre Y', -0.5, 1.5, 0.001, 0.5, GlassSection.Layout),
  diameter: n('Diameter', 0.02, 1.5, 0.001, 0.3, GlassSection.Layout),
  presence: n('Presence', 0, 1, 0.01, 1, GlassSection.Layout),
  refraction: n('Refraction', 0, 1, 0.01, 0.6, GlassSection.Look),
  frost: n('Frost blur', 0, 40, 0.1, 2, GlassSection.Look),
  tintAmount: n('Tint amount', 0, 1, 0.01, 0.01, GlassSection.Look),
  rim: n('Rim width', 0, 12, 0.1, 1.4, GlassSection.Look),
  wobble: n('Wobble', 0, 0.2, 0.001, 0.02, GlassSection.Motion),
  wobbleSpeed: n('Wobble speed (Hz)', 0, 4, 0.01, 0.6, GlassSection.Motion)
} as const;

export type GlassNumberKey = keyof typeof GLASS_NUMBERS;
export const GLASS_NUMBER_KEYS = Object.keys(GLASS_NUMBERS) as GlassNumberKey[];
export const GLASS_TINT = { key: 'tint', label: 'Tint', fallback: '#ffffff' } as const;

export const MAGNIFY = 1.35;
export const RIM_BEND = 0.9;
const RIM_SHARPNESS = 8;

export function lensProfile(rho: number): number {
  const r = Math.min(Math.max(rho, 0), 1);
  return -(1 - 1 / MAGNIFY) * r + RIM_BEND * r ** RIM_SHARPNESS;
}

export const PROFILE_PEAK = Math.max(...Array.from({ length: 101 }, (_, i) => Math.abs(lensProfile(i / 100))));
