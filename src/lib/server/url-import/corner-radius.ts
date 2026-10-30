const KAPPA = 0.5522847498;
const NUMBER = /-?\d+(?:\.\d+)?/g;
const TOLERANCE = 0.002;

type Box = { width: number; height: number };

const numbersIn = (path: string) => (path.match(NUMBER) ?? []).map(Number);

function roundedNumbers(rx: number, ry: number): number[] {
  const [kx, ky] = [rx * (1 - KAPPA), ry * (1 - KAPPA)];
  return [rx, 0, 1 - rx, 0, 1 - kx, 0, 1, ky, 1, ry, 1, 1 - ry, 1, 1 - ky, 1 - kx, 1, 1 - rx, 1, rx, 1, kx, 1, 0, 1 - ky, 0, 1 - ry, 0, ry, 0, ky, kx, 0, rx, 0];
}

function sameNumbers(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= TOLERANCE);
}

export function uniformRadius(path: string, box: Box): number | null {
  const found = numbersIn(path);
  const radius = found[0] * box.width;
  if (!(radius > 0)) {
    return null;
  }
  return sameNumbers(found, roundedNumbers(radius / box.width, radius / box.height)) ? radius : null;
}
