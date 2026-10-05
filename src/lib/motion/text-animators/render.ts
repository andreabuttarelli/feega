import { esc } from '../hyperframes/html';
import { COLOR_VALUE, SELECTOR_KEYS, SelectorShape, VALUE_KEYS, cssName, type TextAnimator, type ValueKey } from './model';
import { HARD_EDGE, splitLines } from './split';

export type TextRender = { lines: (text: string) => string[]; id: string | null; vars: Record<string, string | number>; style: string; seed: number | null };

export const PLAIN_TEXT: TextRender = { lines: (text) => text.split('\n').map(esc), id: null, vars: {}, style: '', seed: null };

export const ANIMATOR_CSS = '.tu,.tw{display:inline-block}.tw{white-space:nowrap}';

export function textHostId(clipId: string): string {
  return `ta-${clipId}`;
}

const v = (a: TextAnimator, field: string) => `var(${cssName(a.id, field)})`;

function selectionVars(a: TextAnimator, i: number): string {
  const soft = a.shape === SelectorShape.Square ? String(HARD_EDGE) : `max(${v(a, 'softness')}, ${HARD_EDGE})`;
  const from = `(${v(a, 'start')} + ${v(a, 'offset')}) / 100`;
  const to = `(${v(a, 'end')} + ${v(a, 'offset')}) / 100`;
  const enter = `--in${i}:clamp(0, (var(--p) - ${from}) / ${soft}, 1)`;
  const leave = `--out${i}:clamp(0, (${to} - var(--p)) / ${soft}, 1)`;
  const eased = (n: string) => `var(${n}) * var(${n}) * (3 - 2 * var(${n}))`;
  const amount = a.shape === SelectorShape.Smooth ? `--a${i}:calc(${eased(`--in${i}`)} * ${eased(`--out${i}`)})` : `--a${i}:calc(var(--in${i}) * var(--out${i}))`;
  return [enter, leave, amount].join(';');
}

type Part = (a: TextAnimator, i: number) => string | null;

const has = (a: TextAnimator, key: ValueKey) => a.values[key] !== undefined;

const OPACITY: Part = (a, i) => (has(a, 'opacity') ? `(1 - var(--a${i}) * (1 - ${v(a, 'opacity')}))` : null);
const TRANSFORM: Part = (a, i) => {
  const parts = [
    has(a, 'x') || has(a, 'y') ? `translate(calc(var(--a${i}) * ${has(a, 'x') ? v(a, 'x') : '0'} * 1em), calc(var(--a${i}) * ${has(a, 'y') ? v(a, 'y') : '0'} * 1em))` : null,
    has(a, 'rotation') ? `rotate(calc(var(--a${i}) * ${v(a, 'rotation')} * 1deg))` : null,
    has(a, 'scale') ? `scale(calc(1 + var(--a${i}) * (${v(a, 'scale')} - 1)))` : null
  ].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
};
const BLUR: Part = (a, i) => (has(a, 'blur') ? `var(--a${i}) * ${v(a, 'blur')} * 1px` : null);
const TRACKING: Part = (a, i) => (has(a, 'tracking') ? `var(--a${i}) * ${v(a, 'tracking')} * 1em` : null);
const COLOUR: Part = (a, i) => (a.values.color !== undefined ? `color-mix(in srgb, ${v(a, COLOR_VALUE)} calc(var(--a${i}) * 100%), currentColor)` : null);

function collect(animators: readonly TextAnimator[], part: Part): string[] {
  return animators.map((a, i) => part(a, i)).filter((s): s is string => s !== null);
}

function unitRule(animators: readonly TextAnimator[]): string {
  const opacity = collect(animators, OPACITY);
  const transform = collect(animators, TRANSFORM);
  const blur = collect(animators, BLUR);
  const tracking = collect(animators, TRACKING);
  const colour = collect(animators, COLOUR).at(-1);
  const declarations = [
    ...animators.map(selectionVars),
    opacity.length ? `opacity:calc(${opacity.length === 1 ? opacity[0].slice(1, -1) : opacity.join(' * ')})` : '',
    transform.length ? `transform:${transform.join(' ')}` : '',
    blur.length ? `filter:blur(calc(${blur.join(' + ')}))` : '',
    tracking.length ? `letter-spacing:calc(${tracking.join(' + ')})` : '',
    colour ? `color:${colour}` : ''
  ].filter(Boolean);
  return declarations.join(';');
}

function hostVars(animators: readonly TextAnimator[], resolve: (c: string) => string): Record<string, string | number> {
  return Object.fromEntries(
    animators.flatMap((a) => [
      ...SELECTOR_KEYS.map((k): [string, number] => [cssName(a.id, k), a[k]]),
      ...VALUE_KEYS.filter((k) => has(a, k)).map((k): [string, number] => [cssName(a.id, k), a.values[k]!]),
      ...(a.values.color === undefined ? [] : [[cssName(a.id, COLOR_VALUE), resolve(a.values.color)] as [string, string]])
    ])
  );
}

export function textRender(clipId: string, animators: readonly TextAnimator[], resolve: (c: string) => string): TextRender {
  if (!animators.length) {
    return PLAIN_TEXT;
  }
  const split = animators[0];
  return {
    lines: (text) => splitLines(text, { unit: split.unit, seed: split.seed }),
    id: textHostId(clipId),
    vars: hostVars(animators, resolve),
    style: `<style>#${textHostId(clipId)} .tu{${unitRule(animators)}}</style>`,
    seed: split.seed
  };
}
