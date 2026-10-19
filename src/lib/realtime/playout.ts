export type Values = Record<string, number>;

const MIN_DELAY_MS = 30;
const MAX_DELAY_MS = 250;
const START_DELAY_MS = 100;
const JITTER_MARGIN = 2.5;
const JITTER_WEIGHT = 0.1;
const EASE = 0.08;
const MAX_STEP_MS = 10;
export const EXTRAPOLATE_MS = 60;
export const SNAP_PX = 400;
const KEPT = 12;

type Point = { at: number; value: Values };

const lerp = (a: Values, b: Values, k: number): Values =>
  Object.fromEntries(Object.keys(b).map((key) => [key, (a[key] ?? b[key]) + ((b[key] - (a[key] ?? b[key])) * k)]));

const distance = (a: Values, b: Values) => Math.hypot((b.x ?? 0) - (a.x ?? 0), (b.y ?? 0) - (a.y ?? 0));

function medianGap(points: Point[]): number {
  const gaps = points.slice(1).map((p, i) => p.at - points[i].at).sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] ?? 0;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export function playout() {
  const points: Point[] = [];
  let offset = Infinity;
  let jitter = 0;
  let delay = START_DELAY_MS;

  function retune(lateness: number) {
    jitter += (lateness - jitter) * JITTER_WEIGHT;
    const target = clamp(medianGap(points) + JITTER_MARGIN * jitter, MIN_DELAY_MS, MAX_DELAY_MS);
    delay += clamp((target - delay) * EASE, -MAX_STEP_MS, MAX_STEP_MS);
  }

  function between(time: number): Values | null {
    const after = points.findIndex((p) => p.at >= time);
    if (after === 0) {
      return points[0].value;
    }
    if (after > 0) {
      const a = points[after - 1];
      const b = points[after];
      if (distance(a.value, b.value) > SNAP_PX) {
        return time - a.at < b.at - time ? a.value : b.value;
      }
      return lerp(a.value, b.value, (time - a.at) / Math.max(1, b.at - a.at));
    }
    return beyond(time);
  }

  function beyond(time: number): Values {
    const last = points[points.length - 1];
    const prev = points[points.length - 2];
    if (!prev || distance(prev.value, last.value) > SNAP_PX) {
      return last.value;
    }
    const over = time - last.at;
    const ahead = over <= EXTRAPOLATE_MS ? over : Math.max(0, 2 * EXTRAPOLATE_MS - over);
    return lerp(prev.value, last.value, 1 + ahead / Math.max(1, last.at - prev.at));
  }

  return {
    push(sentAt: number, receivedAt: number, value: Values) {
      offset = Math.min(offset, receivedAt - sentAt);
      if (points.length && sentAt <= points[points.length - 1].at) {
        return;
      }
      points.push({ at: sentAt, value });
      if (points.length > KEPT) {
        points.shift();
      }
      retune(receivedAt - sentAt - offset);
    },
    sample(now: number): Values | null {
      if (!points.length) {
        return null;
      }
      return between(now - offset - delay);
    },
    delay: () => delay,
    idleSince: () => (points.length ? points[points.length - 1].at + offset : -Infinity)
  };
}
