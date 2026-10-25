import { glassShape, type GlassValues } from '../glass/shape';
import { glassAttrs, type Attrs } from '../hyperframes/glass-attrs';
import { blobShape, centreOf, poseRow, radiusOf, strainTarget, type BlobValues } from '../blob/shape';
import { JELLY_AT_REST, jellyOf, jellyStep, type Vec } from '../blob/geometry';
import { BLOB_LIVE, BLOB_REDRAW, type BlobOverride } from '../hyperframes/blob-live';
import { LensKind, type LensSpec } from './paint';
import { laneName } from './live';

type Size = { width: number; height: number; fps: number };
type LensWindow = Window & Record<string, unknown>;
type Values = Record<string, number>;
type Lens = { tick: (values: Values, tint: string, local: number, dt: number) => void; paint: () => void };

export type LensPainter = { tick: (live: Map<string, number>, frame: number, dt: number) => void; paint: () => void };

const CENTRE_SAMPLES = 3;

function glassLens(spec: LensSpec, size: Size, win: LensWindow): Lens {
  let attrs = new Map<string, Attrs>();
  return {
    tick: (values, tint, local) => {
      attrs = glassAttrs(spec.id, glassShape(values as GlassValues, tint, local, size));
    },
    paint: () => {
      for (const [id, set] of attrs) {
        const el = win.document.getElementById(id);
        if (!el) {
          continue;
        }
        Object.entries(set).forEach(([name, value]) => el.setAttribute(name, String(value)));
      }
    }
  };
}

function blobLens(spec: LensSpec, size: Size, win: LensWindow): Lens {
  const overrides = (win[BLOB_LIVE] ??= {}) as Record<string, BlobOverride>;
  let centres: Vec[] = [];
  let jelly = JELLY_AT_REST;
  return {
    tick: (values, tint, _local, dt) => {
      const v = values as BlobValues;
      if (dt > 0) {
        centres = [...centres, centreOf(v, size)].slice(-CENTRE_SAMPLES);
      }
      if (dt > 0 && centres.length === CENTRE_SAMPLES) {
        const [before, here, after] = centres;
        jelly = jellyStep(jelly, strainTarget({ before, here, after, seconds: dt }, radiusOf(v, size), v.stretch), jellyOf(v.viscosity), dt);
      }
      overrides[spec.id] = { row: poseRow(blobShape(v, tint, jelly.e, size)), seed: v.seed };
    },
    paint: () => (win[BLOB_REDRAW] as (() => void) | undefined)?.()
  };
}

const LENS: Record<LensKind, (spec: LensSpec, size: Size, win: LensWindow) => Lens> = {
  [LensKind.Glass]: glassLens,
  [LensKind.Blob]: blobLens
};

const at = <T>(series: readonly T[], local: number): T => series[Math.min(local, series.length - 1)];

export function lensPainter(specs: readonly LensSpec[], size: Size, win: LensWindow): LensPainter {
  const lenses = specs.map((spec) => ({ spec, lens: LENS[spec.kind](spec, size, win) }));
  return {
    tick: (live, frame, dt) => {
      for (const { spec, lens } of lenses) {
        const local = Math.min(Math.max(frame - spec.from, 0), spec.length - 1);
        const values = Object.fromEntries(Object.entries(spec.base).map(([key, series]) => [key, live.get(laneName({ id: spec.id, key })) ?? at(series, local)]));
        lens.tick(values, at(spec.tint, local), local, dt);
      }
    },
    paint: () => lenses.forEach(({ lens }) => lens.paint())
  };
}
