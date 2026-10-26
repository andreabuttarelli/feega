export type Luma = { width: number; height: number; data: Uint8Array };

const RED = 0.299;
const GREEN = 0.587;
const BLUE = 0.114;
const CHANNELS = 4;

export function lumaOf(rgba: ArrayLike<number>, width: number, height: number): Luma {
  const data = new Uint8Array(width * height);

  for (let i = 0; i < data.length; i++) {
    const at = i * CHANNELS;
    data[i] = Math.round(rgba[at] * RED + rgba[at + 1] * GREEN + rgba[at + 2] * BLUE);
  }
  return { width, height, data };
}
