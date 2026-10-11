export const EMPTY_EDGE_DENSITY = 0.02;
export const EMPTY_PROBE_PX = 160;

const EDGE_STEP = 48;

export function edgeDensity(gray: Uint8Array, width: number, height: number): number {
  let edges = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const dx = x + 1 < width ? Math.abs(gray[i + 1] - gray[i]) : 0;
      const dy = y + 1 < height ? Math.abs(gray[i + width] - gray[i]) : 0;
      edges += dx + dy > EDGE_STEP ? 1 : 0;
    }
  }
  return edges / (width * height);
}
