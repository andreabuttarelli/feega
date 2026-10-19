export type Size = { width: number; height: number };

export function grownBacking(surface: Size, backing: Size): Size | null {
  if (surface.width <= backing.width && surface.height <= backing.height) {
    return null;
  }
  return { width: Math.max(surface.width, backing.width), height: Math.max(surface.height, backing.height) };
}
