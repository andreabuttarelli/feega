export enum BlobSection {
  Layout = 'layout',
  Glass = 'glass',
  Motion = 'motion'
}

export type BlobNumber = { label: string; min: number; max: number; step: number; fallback: number; section: BlobSection };

const n = (label: string, min: number, max: number, step: number, fallback: number, section: BlobSection): BlobNumber => ({ label, min, max, step, fallback, section });

export const MAX_DROPS = 4;

export const BLOB_NUMBERS = {
  centerX: n('Centre X', -0.5, 1.5, 0.001, 0.5, BlobSection.Layout),
  centerY: n('Centre Y', -0.5, 1.5, 0.001, 0.5, BlobSection.Layout),
  diameter: n('Diameter', 0.02, 1.5, 0.001, 0.3, BlobSection.Layout),
  drops: n('Drops', 1, MAX_DROPS, 1, 1, BlobSection.Layout),
  split: n('Split distance', 0, 1.5, 0.001, 0, BlobSection.Layout),
  splitAngle: n('Split angle', -360, 360, 1, 0, BlobSection.Layout),
  presence: n('Presence', 0, 1, 0.01, 1, BlobSection.Layout),
  ior: n('Index of refraction', 1, 2.4, 0.01, 1.42, BlobSection.Glass),
  dispersion: n('Dispersion', 0, 0.3, 0.001, 0.025, BlobSection.Glass),
  frost: n('Frost blur', 0, 40, 0.1, 0, BlobSection.Glass),
  reflection: n('Reflection', 0, 2, 0.01, 1, BlobSection.Glass),
  tintAmount: n('Tint amount', 0, 1, 0.01, 0.06, BlobSection.Glass),
  blend: n('Melt', 0.05, 1.5, 0.01, 0.6, BlobSection.Motion),
  viscosity: n('Viscosity', 0, 1, 0.01, 0.5, BlobSection.Motion),
  wobble: n('Wobble', 0, 1, 0.01, 0.35, BlobSection.Motion),
  wobbleSpeed: n('Wobble speed (Hz)', 0, 4, 0.01, 0.7, BlobSection.Motion),
  stretch: n('Stretch', 0, 2, 0.01, 1, BlobSection.Motion),
  seed: n('Seed', 0, 999, 1, 7, BlobSection.Motion)
} as const;

export type BlobNumberKey = keyof typeof BLOB_NUMBERS;
export const BLOB_NUMBER_KEYS = Object.keys(BLOB_NUMBERS) as BlobNumberKey[];
export const BLOB_TINT = { key: 'tint', label: 'Tint', fallback: '#dfe9ff' } as const;
