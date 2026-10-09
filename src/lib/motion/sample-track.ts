import { Ease } from './design';

export type SampledKey = { frame: number; value: number | string; ease: string | number[]; in?: string; out?: string; roving?: boolean };

export function sampleTrack(track: SampledKey[], frame: number): number {
  const expoIn = (p: number) => 2 ** (10 * (p - 1)) * p + p ** 6 * (1 - p);
  const expoOut = (p: number) => 1 - expoIn(1 - p);
  const expoInOut = (p: number) => (p < 0.5 ? expoIn(p * 2) / 2 : 1 - expoIn((1 - p) * 2) / 2);
  const settled = (ease: (p: number) => number, depth: number, lateness: number) => (p: number) => ease(p) + depth * p ** lateness * (1 - p);
  const curves: Record<string, (p: number) => number> = {
    standard: settled(expoInOut, 0.35, 12),
    enter: settled(expoOut, 0.2, 6),
    exit: expoIn,
    linear: (p) => p,
    overshoot: (p) => {
      const q = p - 1;
      return p ? q * q * (2.7 * q + 1.7) + 1 : 0;
    }
  };
  const handles: Record<string, number[]> = {
    standard: [0.87, 0, 0.13, 1],
    enter: [0.16, 1, 0.3, 1],
    exit: [0.7, 0, 0.84, 0],
    linear: [1 / 3, 1 / 3, 2 / 3, 2 / 3],
    overshoot: [0.175, 0.885, 0.32, 1.275]
  };
  const cubic = (a: number, b: number, c: number, d: number, t: number) => {
    const u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  };
  const along = (x1: number, x2: number, p: number) => {
    let lo = 0;
    let hi = 1;
    let t = p;
    for (let i = 0; i < 48; i++) {
      if (cubic(0, x1, x2, 1, t) < p) {
        lo = t;
      } else {
        hi = t;
      }
      t = (lo + hi) / 2;
    }
    return t;
  };
  const bezier = (b: number[], p: number) => {
    if (p <= 0 || p >= 1) {
      return p <= 0 ? 0 : 1;
    }
    return cubic(0, b[1], b[3], 1, along(b[0], b[2], p));
  };

  const keys = track.map((k) => ({ ...k, frame: k.frame }));
  let fixed = 0;
  for (let i = 1; i < keys.length; i++) {
    if (keys[i].roving && i < keys.length - 1) {
      continue;
    }
    let total = 0;
    const walked = [0];
    for (let j = fixed + 1; j <= i; j++) {
      total += Math.abs(Number(keys[j].value) - Number(keys[j - 1].value));
      walked.push(total);
    }
    for (let j = fixed + 1; j < i && total > 0; j++) {
      keys[j].frame = keys[fixed].frame + ((keys[i].frame - keys[fixed].frame) * walked[j - fixed]) / total;
    }
    fixed = i;
  }

  const first = keys[0];
  const last = keys[keys.length - 1];
  if (frame <= first.frame) {
    return Number(first.value);
  }
  if (frame >= last.frame) {
    return Number(last.value);
  }

  let i = 0;
  while (keys[i + 1].frame <= frame) {
    i++;
  }
  const a = keys[i];
  const b = keys[i + 1];
  const va = Number(a.value);
  const vb = Number(b.value);
  const dt = b.frame - a.frame;
  const dv = vb - va;
  const p = (frame - a.frame) / dt;
  const out = a.out ?? 'bezier';
  const into = b.in ?? 'bezier';

  if (out === 'hold' || into === 'hold') {
    return va;
  }
  if (out === 'bezier' && into === 'bezier') {
    const eased = typeof a.ease === 'string' ? curves[a.ease](p) : bezier(a.ease, p);
    return va + dv * eased;
  }

  const through = (k: number, clamp: boolean) => {
    if (k === 0 || k === keys.length - 1) {
      return 0;
    }
    const before = Number(keys[k].value) - Number(keys[k - 1].value);
    const after = Number(keys[k + 1].value) - Number(keys[k].value);
    if (clamp && before * after <= 0) {
      return 0;
    }
    return (Number(keys[k + 1].value) - Number(keys[k - 1].value)) / (keys[k + 1].frame - keys[k - 1].frame);
  };
  const slopeOf: Record<string, (k: number) => number> = {
    linear: () => dv / dt,
    auto: (k) => through(k, true),
    continuous: (k) => through(k, false)
  };
  const ease = typeof a.ease === 'string' ? handles[a.ease] : a.ease;
  const x1 = out === 'bezier' ? ease[0] : 1 / 3;
  const y1 = out === 'bezier' ? va + ease[1] * dv : va + (slopeOf[out](i) * dt) / 3;
  const x2 = into === 'bezier' ? ease[2] : 2 / 3;
  const y2 = into === 'bezier' ? va + ease[3] * dv : vb - (slopeOf[into](i + 1) * dt) / 3;
  return cubic(va, y1, y2, vb, along(x1, x2, p));
}

export const easeCurve = (ease: string | number[]) => (p: number) => sampleTrack([{ frame: 0, value: 0, ease }, { frame: 1, value: 1, ease: Ease.Linear }], p);
