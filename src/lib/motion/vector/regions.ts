import type { VectorRegion, VectorSegment } from './model';

const MIN_LOOP = 2;

export function remapRegions(regions: readonly VectorRegion[], indexMap: Map<number, number | null>): VectorRegion[] {
  return regions.flatMap((region) => {
    const loops = region.loops.flatMap((loop) => {
      const next: number[] = [];
      for (const index of loop) {
        const mapped = indexMap.get(index);
        if (mapped == null || next.at(-1) === mapped) {
          continue;
        }
        next.push(mapped);
      }
      if (next.length > 1 && next[0] === next.at(-1)) {
        next.pop();
      }
      return next.length >= MIN_LOOP ? [next] : [];
    });
    return loops.length ? [{ ...region, loops }] : [];
  });
}

export function reindexRegionLoops(regions: readonly VectorRegion[], replaced: number, parts: readonly number[], segments: readonly VectorSegment[]): VectorRegion[] {
  return regions.map((region) => ({
    ...region,
    loops: region.loops.map((loop) =>
      loop.flatMap((index, i) => {
        if (index !== replaced) {
          return [index];
        }
        const original = segments[replaced];
        const following = segments[loop[(i + 1) % loop.length]];
        const forward = original.end === following.start || original.end === following.end;
        return forward ? [...parts] : [...parts].reverse();
      })
    )
  }));
}
