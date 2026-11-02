import type { Slider } from './units';

const HUNDRED = 100;
const PRECISION = 100;

const IN_PERCENT: ReadonlySet<string> = new Set(['leading', 'tracking']);

const factor = (key: string) => (IN_PERCENT.has(key) ? HUNDRED : 1);

const tidy = (n: number) => Math.round(n * PRECISION) / PRECISION;

export const percentShown = (key: string, value: number): number => tidy(value * factor(key));

export const percentStored = (key: string, value: number): number => value / factor(key);

export function percentSlider(key: string, slider: Slider): Slider {
  const by = factor(key);
  return { ...slider, min: tidy(slider.min * by), max: tidy(slider.max * by), step: tidy(slider.step * by) };
}
