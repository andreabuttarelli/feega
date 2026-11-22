export enum CoverShape {
  Orb = 'orb',
  Diamond = 'diamond',
  Waves = 'waves',
  Rings = 'rings',
  Diagonal = 'diagonal',
  Twin = 'twin'
}

export type Cover = { readonly shape: CoverShape; readonly ramp: string; readonly flag: number };

const ASPECT = 0.5;

const SHAPES = Object.values(CoverShape);

const RAMPS = [' .:-=+*#', ' ·•●', ' /\\X', ' .oO@', ' -~≈', ' +x#', ' ░▒▓'];

const DENSITY: Readonly<Record<CoverShape, (x: number, y: number) => number>> = {
  [CoverShape.Orb]: (x, y) => 1 - Math.hypot(x - 0.5, (y - 0.5) * ASPECT) * 2.6,
  [CoverShape.Diamond]: (x, y) => 1 - (Math.abs(x - 0.5) + Math.abs(y - 0.5) * ASPECT) * 2.4,
  [CoverShape.Waves]: (x, y) => 0.5 + 0.5 * Math.sin(x * 14 + Math.sin(y * 6) * 2) * (1 - Math.abs(y - 0.5) * 1.6),
  [CoverShape.Rings]: (x, y) => 0.5 + 0.5 * Math.cos(Math.hypot(x - 0.5, (y - 0.5) * 1.6) * 40) - Math.hypot(x - 0.5, y - 0.5),
  [CoverShape.Diagonal]: (x, y) => 0.5 + 0.5 * Math.sin((x + y) * 18) * (x * (1 - x) * 4),
  [CoverShape.Twin]: (x, y) => Math.max(1 - Math.hypot(x - 0.3, (y - 0.5) * ASPECT) * 4.2, 1 - Math.hypot(x - 0.7, (y - 0.5) * ASPECT) * 4.2)
};

export const coverFor = (index: number): Cover => ({
  shape: SHAPES[index % SHAPES.length],
  ramp: RAMPS[(index * 3) % RAMPS.length],
  flag: index
});

export function densityAt(shape: CoverShape, x: number, y: number): number {
  return Math.min(1, Math.max(0, DENSITY[shape](x, y)));
}

export function glyphAt(ramp: string, density: number): string {
  return ramp[Math.min(ramp.length - 1, Math.floor(density * ramp.length))];
}
