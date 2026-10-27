import { apply2d, mul2d, type Affine } from "../affine";
import { invert2d } from "../parent";
import { MaskMode } from "../mask";
import { CoverKind, type MaskLayer } from "./mask-layers";
import { fitCorners } from "./dom/css";

export type Warp = (p: [number, number]) => [number, number];

export const warpContours = (
  contours: number[][],
  local: Affine,
  warp: Warp,
) => {
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

type Warpable = {
  kind: string;
  matrix: Affine;
  contours?: number[][];
  masks?: MaskLayer[];
  items?: Warpable[];
  matte?: { items: Warpable[] };
  size?: unknown;
};

type Box = { width: number; height: number };

const boxed = (size: unknown): Box | null =>
  typeof size === "object" && size !== null ? (size as Box) : null;

export function warpItem<T extends Warpable>(item: T, warp: Warp): T[] {
  const masks = warpMasks(item.masks, warp);
  const box = boxed(item.size);
  const parts = box && projectedTiles(item.matrix, box.width, box.height, warp);

  if (parts) {
    return parts.map(({ matrix, cut }) => ({
      ...item,
      matrix,
      masks: [...(masks ?? []), cut],
    }));
  }
  return [
    {
      ...item,
      ...(masks ? { masks } : {}),
      ...(item.contours
        ? { contours: warpContours(item.contours, item.matrix, warp) }
        : {}),
      ...(item.items
        ? { items: item.items.flatMap((i) => warpItem(i, warp)) }
        : {}),
      ...(item.matte
        ? {
            matte: {
              ...item.matte,
              items: item.matte.items.flatMap((i) => warpItem(i, warp)),
            },
          }
        : {}),
    },
  ];
}

const PROJECTED_TILES = 6;
const TILE_SEAM = 0.5;
const FLAT_MISS = 0.5;
const PROBES = [0, 0.5, 1];

type Point = [number, number];

const fitsFlat = (matrix: Affine, w: number, h: number, warp: Warp) =>
  PROBES.every((u) =>
    PROBES.every((v) => {
      const p = apply2d(matrix, [u * w, v * h]);
      const q = warp(p);
      return Math.hypot(q[0] - p[0], q[1] - p[1]) < FLAT_MISS;
    }),
  );

const grown = (quad: Point[]): number[] => {
  const [cx, cy] = [0, 1].map(
    (k) => quad.reduce((s, p) => s + p[k], 0) / quad.length,
  );
  return quad.flatMap(([x, y]) => {
    const reach = Math.hypot(x - cx, y - cy) || 1;
    return [
      x + ((x - cx) / reach) * TILE_SEAM,
      y + ((y - cy) / reach) * TILE_SEAM,
    ];
  });
};

export type ProjectedTile = { matrix: Affine; cut: MaskLayer };

export function projectedTiles(
  matrix: Affine,
  width: number,
  height: number,
  warp: Warp,
): ProjectedTile[] | null {
  if (fitsFlat(matrix, width, height, warp)) {
    return null;
  }
  const [w, h] = [width / PROJECTED_TILES, height / PROJECTED_TILES];
  return Array.from({ length: PROJECTED_TILES ** 2 }, (_, k) => {
    const [u, v] = [
      (k % PROJECTED_TILES) * w,
      Math.floor(k / PROJECTED_TILES) * h,
    ];
    const quad = (
      [
        [u, v],
        [u + w, v],
        [u + w, v + h],
        [u, v + h],
      ] as Point[]
    ).map((p) => warp(apply2d(matrix, p)));
    return {
      matrix: mul2d(fitCorners(quad, { w, h }), [1, 0, 0, 1, -u, -v]),
      cut: {
        mode: MaskMode.Intersect,
        invert: false,
        level: 1,
        feather: 0,
        cover: {
          kind: CoverKind.Path,
          contours: [grown(quad)],
          matrix: [1, 0, 0, 1, 0, 0],
        },
      },
    };
  });
}
