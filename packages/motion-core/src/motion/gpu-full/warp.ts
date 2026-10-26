import { apply2d, type Affine } from '../affine';
import { invert2d } from '../parent';
import { CoverKind, type MaskLayer } from './mask-layers';

export type Warp = (p: [number, number]) => [number, number];

export const warpContours = (contours: number[][], local: Affine, warp: Warp) => {
  const back = invert2d(local);
  return contours.map((c) =>
    c.flatMap((_, i) =>
      i % 2 ? [] : apply2d(back, warp(apply2d(local, [c[i], c[i + 1]]))),
    ),
  );
};

export const warpMasks = (masks: MaskLayer[] | undefined, warp: Warp) =>
  masks?.map((m) =>
    m.cover.kind === CoverKind.Path
      ? {
          ...m,
          cover: {
            ...m.cover,
            contours: warpContours(m.cover.contours, m.cover.matrix, warp),
          },
        }
      : m,
  );
