export type Spring = { stiffness: number; damping: number };
export type Step = { at: number; delta: number; spring: Spring };
export type SpringKey = readonly [at: number, value: number];
export type EdgeKey = readonly [at: number, lo: number, hi: number];

export const SPRINGS = {
  ui: { stiffness: 320, damping: 30 },
  soft: { stiffness: 140, damping: 24 },
  camera: { stiffness: 90, damping: 19 },
  lead: { stiffness: 520, damping: 46 },
  trail: { stiffness: 170, damping: 27 }
} as const satisfies Record<string, Spring>;

export function springMath() {
  const CRITICAL_BAND = 1e-6;
  const SETTLED = Math.log(1000);
  const PAST_CYCLES = 4;

  const kernel = (stiffness: number, damping: number, t: number, e0: number, v0: number): [number, number] => {
    const w0 = Math.sqrt(stiffness);
    const zeta = damping / (2 * w0);
    if (Math.abs(zeta - 1) < CRITICAL_BAND) {
      const decay = Math.exp(-w0 * t);
      const b = v0 + w0 * e0;
      return [decay * (e0 + b * t), decay * (b - w0 * (e0 + b * t))];
    }
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      const decay = Math.exp(-zeta * w0 * t);
      const b = (v0 + zeta * w0 * e0) / wd;
      const cos = Math.cos(wd * t);
      const sin = Math.sin(wd * t);
      const x = decay * (e0 * cos + b * sin);
      return [x, -zeta * w0 * x + decay * (-e0 * wd * sin + b * wd * cos)];
    }
    const root = w0 * Math.sqrt(zeta * zeta - 1);
    const r1 = -zeta * w0 + root;
    const r2 = -zeta * w0 - root;
    const a = (v0 - r2 * e0) / (r1 - r2);
    const b = e0 - a;
    return [a * Math.exp(r1 * t) + b * Math.exp(r2 * t), a * r1 * Math.exp(r1 * t) + b * r2 * Math.exp(r2 * t)];
  };

  const step = (spring: Spring, t: number): number => (t <= 0 ? 0 : 1 - kernel(spring.stiffness, spring.damping, t, 1, 0)[0]);

  const stepVelocity = (spring: Spring, t: number): number => (t <= 0 ? 0 : -kernel(spring.stiffness, spring.damping, t, 1, 0)[1]);

  const sum = (base: number, steps: readonly Step[], t: number, period: number, each: (spring: Spring, t: number) => number): number => {
    const cycles = period > 0 ? PAST_CYCLES : 0;
    let value = base;
    for (let k = 0; k <= cycles; k++) {
      for (const s of steps) {
        value += s.delta * each(s.spring, t - s.at + k * period);
      }
    }
    return value;
  };

  const sumSteps = (base: number, steps: readonly Step[], t: number, period = 0): number => sum(base, steps, t, period, step);

  const sumVelocity = (steps: readonly Step[], t: number, period = 0): number => sum(0, steps, t, period, stepVelocity);

  const trackChanges = (keys: readonly SpringKey[], spring: Spring): Step[] => {
    const steps: Step[] = [];
    for (let i = 1; i < keys.length; i++) {
      const delta = keys[i][1] - keys[i - 1][1];
      if (delta !== 0) {
        steps.push({ at: keys[i][0], delta, spring });
      }
    }
    return steps;
  };

  const loopChanges = (keys: readonly SpringKey[], period: number, spring: Spring): Step[] => {
    const closed = [...keys, [period, keys[0][1]] as SpringKey];
    return trackChanges(closed, spring);
  };

  const springTrack = (keys: readonly SpringKey[], t: number, spring: Spring): number => (keys.length ? sumSteps(keys[0][1], trackChanges(keys, spring), t) : 0);

  const edgeChanges = (keys: readonly EdgeKey[], lead: Spring, trail: Spring): { lo: Step[]; hi: Step[] } => {
    const lo: Step[] = [];
    const hi: Step[] = [];
    for (let i = 1; i < keys.length; i++) {
      const [at, l, h] = keys[i];
      const dl = l - keys[i - 1][1];
      const dh = h - keys[i - 1][2];
      const forward = dl + dh >= 0;
      lo.push({ at, delta: dl, spring: forward ? trail : lead });
      hi.push({ at, delta: dh, spring: forward ? lead : trail });
    }
    return { lo, hi };
  };

  const edgePair = (keys: readonly EdgeKey[], t: number, lead: Spring, trail: Spring): [number, number] => {
    const { lo, hi } = edgeChanges(keys, lead, trail);
    return [sumSteps(keys[0][1], lo, t), sumSteps(keys[0][2], hi, t)];
  };

  const overshootOf = (spring: Spring): number => {
    const zeta = spring.damping / (2 * Math.sqrt(spring.stiffness));
    return zeta >= 1 ? 0 : Math.exp((-zeta * Math.PI) / Math.sqrt(1 - zeta * zeta));
  };

  const settleTime = (spring: Spring): number => {
    const w0 = Math.sqrt(spring.stiffness);
    const zeta = spring.damping / (2 * w0);
    const rate = zeta <= 1 ? zeta * w0 : w0 * (zeta - Math.sqrt(zeta * zeta - 1));
    return SETTLED / rate;
  };

  return { kernel, step, stepVelocity, sumSteps, sumVelocity, trackChanges, loopChanges, springTrack, edgeChanges, edgePair, overshootOf, settleTime };
}

export type SpringMath = ReturnType<typeof springMath>;

const math = springMath();

export const springKernel = math.kernel;
export const { sumSteps, sumVelocity, trackChanges, loopChanges, springTrack, edgeChanges, edgePair, overshootOf, settleTime } = math;

export function springSource(): string {
  return `(${springMath.toString()})()`;
}
