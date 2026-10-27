export type GrainArea = { inverse: number[]; width: number; height: number; margin: number };
export type GrainLayer = { amount: number; tile: Uint8ClampedArray; tileSize: number };

export function grainPixels(source: Uint8ClampedArray, width: number, height: number, grains: GrainLayer[], area: GrainArea): Uint8ClampedArray {
  const LUMA = [0.213, 0.715, 0.072];
  const [a, b, c, d, e, f] = area.inverse;
  const lowX = -area.margin * area.width;
  const lowY = -area.margin * area.height;
  const highX = (1 + area.margin) * area.width;
  const highY = (1 + area.margin) * area.height;
  const out = new Uint8ClampedArray(source.length);
  const noise = [0, 0, 0, 0];
  const pixel = [0, 0, 0, 0];

  const sample = (layer: GrainLayer, u: number, v: number) => {
    const size = layer.tileSize;
    const x = u - 0.5;
    const y = v - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const wrap = (n: number) => ((n % size) + size) % size;
    const at = (tx: number, ty: number) => (wrap(ty) * size + wrap(tx)) * 4;
    const p00 = at(x0, y0);
    const p10 = at(x0 + 1, y0);
    const p01 = at(x0, y0 + 1);
    const p11 = at(x0 + 1, y0 + 1);
    for (let k = 0; k < 4; k++) {
      const top = layer.tile[p00 + k] * (1 - fx) + layer.tile[p10 + k] * fx;
      const bottom = layer.tile[p01 + k] * (1 - fx) + layer.tile[p11 + k] * fx;
      noise[k] = (top * (1 - fy) + bottom * fy) / 255;
    }
  };

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      const alpha = source[i + 3] / 255;
      if (alpha === 0) {
        continue;
      }
      const u = a * (px + 0.5) + c * (py + 0.5) + e;
      const v = b * (px + 0.5) + d * (py + 0.5) + f;
      if (u < lowX || v < lowY || u >= highX || v >= highY) {
        continue;
      }

      pixel[3] = alpha;
      for (let k = 0; k < 3; k++) {
        pixel[k] = (source[i + k] / 255) * alpha;
      }
      for (const layer of grains) {
        sample(layer, u, v);
        const gray = (LUMA[0] * noise[0] + LUMA[1] * noise[1] + LUMA[2] * noise[2]) * noise[3];
        const shade = layer.amount;
        const keep = pixel[3];
        const mixedAlpha = Math.min(1, Math.max(0, shade * noise[3] + keep - shade / 2));
        for (let k = 0; k < 3; k++) {
          pixel[k] = Math.min(mixedAlpha, Math.max(0, shade * gray + pixel[k] - shade / 2)) * keep;
        }
        pixel[3] = mixedAlpha * keep;
      }

      if (pixel[3] <= 0) {
        continue;
      }
      for (let k = 0; k < 3; k++) {
        out[i + k] = Math.round((pixel[k] / pixel[3]) * 255);
      }
      out[i + 3] = Math.round(pixel[3] * 255);
    }
  }
  return out;
}
