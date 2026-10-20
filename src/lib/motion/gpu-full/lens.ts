import { blobRows, type BlobClip } from '../blob/pose';
import { ROW } from '../blob/shape';
import { BLOB_NUMBERS, MAX_DROPS } from '../blob/model';

export type Lens = {
  center: [number, number];
  drops: number[];
  unwarp: [number, number, number];
  blend: number;
  wobble: number;
  wobbleSpeed: number;
  ior: number;
  dispersion: number;
  frost: number;
  reflection: number;
  tintAmount: number;
  presence: number;
  tint: [number, number, number];
  box: [number, number, number, number];
  time: number;
  seed: number;
};

export type Stage = { width: number; height: number; fps: number };

const rowsOf = new WeakMap<BlobClip, { key: string; rows: number[][] }>();

function rows(clip: BlobClip, stage: Stage, resolve: (v: string) => string): number[][] {
  const key = `${stage.width}x${stage.height}@${stage.fps}`;
  const kept = rowsOf.get(clip);
  if (kept?.key === key) {
    return kept.rows;
  }
  const made = blobRows(clip, stage, resolve);
  rowsOf.set(clip, { key, rows: made });
  return made;
}

const slice = <T extends number[]>(row: number[], at: number, n: number) => row.slice(at, at + n) as T;

export function lensAt(clip: BlobClip, stage: Stage, local: number, resolve: (v: string) => string): Lens {
  const all = rows(clip, stage, resolve);
  const row = all[Math.min(Math.max(Math.round(local), 0), all.length - 1)];
  return {
    center: slice(row, ROW.center, 2),
    drops: slice(row, ROW.drops, MAX_DROPS * 3),
    unwarp: slice(row, ROW.unwarp, 3),
    blend: row[ROW.blend],
    wobble: row[ROW.wobble],
    wobbleSpeed: row[ROW.wobbleSpeed],
    ior: row[ROW.ior],
    dispersion: row[ROW.dispersion],
    frost: row[ROW.frost],
    reflection: row[ROW.reflection],
    tintAmount: row[ROW.tintAmount],
    presence: row[ROW.presence],
    tint: slice(row, ROW.tint, 3),
    box: slice(row, ROW.box, 4),
    time: local / stage.fps,
    seed: Number(clip.props.seed ?? BLOB_NUMBERS.seed.fallback)
  };
}
