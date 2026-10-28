import { EaseKind, type CodeEase } from '../ease';
import { Trigger, type AnimTrack, type Animation } from '../ir';
import type { CodeFile } from '../model';

export const MOTION_IMPORT = "import { motion } from 'motion/react';";
export const MOTION_VERSION = '^12.0.0';

const PRECISION = 4;

const num = (n: number) => String(Number(n.toFixed(PRECISION)));

const value = (v: number | string) => (typeof v === 'number' ? num(v) : JSON.stringify(v));

const list = (values: (number | string)[]) => `[${values.map(value).join(', ')}]`;

const EASES: { [K in EaseKind]: (e: Extract<CodeEase, { kind: K }>) => string } = {
  [EaseKind.Bezier]: (e) => `[${e.points.map(num).join(', ')}]`,
  [EaseKind.Linear]: () => '"linear"',
  [EaseKind.Hold]: () => 'hold',
  [EaseKind.Sampled]: (e) => `sampled([${e.stops.map(num).join(', ')}])`
};

const easeOf = (e: CodeEase) => (EASES[e.kind] as (e: CodeEase) => string)(e);

const object = (entries: string[]) => `{ ${entries.join(', ')} }`;

function transitionOf(t: AnimTrack): string {
  const fields = [`duration: ${num(t.duration)}`, `delay: ${num(t.delay)}`, `times: ${list(t.times)}`, `ease: [${t.eases.map(easeOf).join(', ')}]`, ...(t.loop ? ['repeat: Infinity'] : [])];
  return `    ${t.channel}: ${object(fields)}`;
}

const frames = (a: Animation) => object(a.tracks.map((t) => `${t.channel}: ${list(t.values)}`));

const initial = (a: Animation) => `  initial: ${object(a.tracks.map((t) => `${t.channel}: ${value(t.values[0])}`))},`;

const PLAY: Record<Trigger, (a: Animation) => string[]> = {
  [Trigger.Load]: (a) => [initial(a), `  animate: ${frames(a)},`],
  [Trigger.InView]: (a) => [initial(a), `  whileInView: ${frames(a)},`, '  viewport: { once: true },'],
  [Trigger.Hover]: (a) => [`  whileHover: ${frames(a)},`]
};

function entry(name: string, a: Animation): string[] {
  return [`export const ${name}: MotionProps = {`, ...PLAY[a.trigger](a), '  transition: {', a.tracks.map(transitionOf).join(',\n'), '  }', '};', ''];
}

const EASING_LIB = [
  'export const hold = (t: number) => (t < 1 ? 0 : 1);',
  '',
  'export const sampled = (stops: number[]) => (t: number) => {',
  '  const x = Math.min(Math.max(t, 0), 1) * (stops.length - 1);',
  '  const i = Math.min(Math.floor(x), stops.length - 2);',
  '  return stops[i] + (stops[i + 1] - stops[i]) * (x - i);',
  '};',
  ''
].join('\n');

export function motionFiles(anims: Map<string, Animation>): CodeFile[] {
  if (!anims.size) {
    return [];
  }
  const kinds = new Set([...anims.values()].flatMap((a) => a.tracks.flatMap((t) => t.eases.map((e) => e.kind))));
  const helpers = [kinds.has(EaseKind.Hold) ? 'hold' : null, kinds.has(EaseKind.Sampled) ? 'sampled' : null].filter(Boolean);
  const head = ["import type { MotionProps } from 'motion/react';", ...(helpers.length ? [`import { ${helpers.join(', ')} } from './lib/easing';`] : []), ''];
  const body = [...anims.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([name, a]) => entry(name, a));
  return [{ path: 'src/animations.ts', content: [...head, ...body].join('\n') }, ...(helpers.length ? [{ path: 'src/lib/easing.ts', content: EASING_LIB }] : [])];
}
