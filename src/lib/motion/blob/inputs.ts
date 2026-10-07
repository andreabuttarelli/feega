import type { BLOB_TINT, BlobNumberKey } from './model';

type BlobInputKey = Exclude<BlobNumberKey, 'presence'> | (typeof BLOB_TINT)['key'];

export const BLOB_INPUT = {
  x: 'centerX',
  y: 'centerY',
  diameter: 'diameter',
  drops: 'drops',
  split: 'split',
  split_angle: 'splitAngle',
  blend: 'blend',
  ior: 'ior',
  dispersion: 'dispersion',
  frost: 'frost',
  reflection: 'reflection',
  tint: 'tint',
  tint_amount: 'tintAmount',
  viscosity: 'viscosity',
  wobble: 'wobble',
  wobble_speed: 'wobbleSpeed',
  stretch: 'stretch',
  seed: 'seed'
} as const satisfies Record<string, BlobInputKey>;
