import { z } from 'zod';
import { EASE_IDS, Ease } from './design';
import { easeCurve } from './sample-track';

export enum CounterFormat {
  Plain = 'plain',
  Grouped = 'grouped',
  Currency = 'currency',
  Percent = 'percent',
  Compact = 'compact'
}

export const COUNTER_FORMATS = Object.values(CounterFormat) as [CounterFormat, ...CounterFormat[]];

export const COUNTER_FORMAT_LABEL: Record<CounterFormat, string> = {
  [CounterFormat.Plain]: '1234',
  [CounterFormat.Grouped]: '1,234',
  [CounterFormat.Currency]: '$1,234',
  [CounterFormat.Percent]: '12%',
  [CounterFormat.Compact]: '1.2K'
};

const MAX_DECIMALS = 6;
const DEFAULT_DURATION_FRAMES = 60;

export const counterSchema = z
  .object({
    from: z.number(),
    to: z.number(),
    format: z.enum(COUNTER_FORMATS).default(CounterFormat.Grouped),
    decimals: z.number().int().min(0).max(MAX_DECIMALS).default(0),
    start: z.number().int().min(0).default(0),
    duration: z.number().int().min(1).default(DEFAULT_DURATION_FRAMES),
    ease: z.enum(EASE_IDS).default(Ease.Enter)
  })
  .strict();

export type Counter = z.infer<typeof counterSchema>;

export function formatCounter(value: number, format: string, decimals: number): string {
  const fixed = (n: number) => n.toFixed(decimals);
  const sign = Number(fixed(value)) < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (format === 'compact') {
    const unit = [
      [1e9, 'B'],
      [1e6, 'M'],
      [1e3, 'K']
    ].find(([size]) => abs >= (size as number));
    return unit ? sign + fixed(abs / (unit[0] as number)) + unit[1] : sign + fixed(abs);
  }
  const [whole, fraction] = fixed(abs).split('.');
  const grouped = format === 'plain' ? whole : whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const number = fraction ? `${grouped}.${fraction}` : grouped;
  if (format === 'currency') {
    return `${sign}$${number}`;
  }
  return format === 'percent' ? `${sign}${number}%` : sign + number;
}

export function counterValue(counter: Counter, frame: number): number {
  const progress = Math.min(1, Math.max(0, (frame - counter.start) / counter.duration));
  return counter.from + (counter.to - counter.from) * easeCurve(counter.ease)(progress);
}

export function counterAt(counter: Counter, frame: number): string {
  return formatCounter(counterValue(counter, frame), counter.format, counter.decimals);
}

export const COUNTER_COMPONENT = 'Text';

export function counted<P extends Record<string, unknown>>(component: string, props: P, frame: number): P {
  const counter = props.counter as Counter | undefined;
  return component === COUNTER_COMPONENT && counter ? { ...props, text: counterAt(counter, frame) } : props;
}
