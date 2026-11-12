import type { Pictures } from '@feega/motion-core/motion/gpu-full/raster';

export function customPictures() {
  const reads = new Map<string, Pictures>();

  const set = (key: string, of: Pictures) => {
    reads.delete(key);
    reads.set(key, of);
  };

  const of: Pictures = (item) => [...reads.values()].reduceRight<ReturnType<Pictures>>((found, read) => found ?? read(item), null);

  return { set, drop: (key: string) => reads.delete(key), of };
}
