import { VALUES, type TextAnimator, type ValueKey } from './model';

export type PreviewLook = { opacity: number; transform: string; filter: string };

type Values = TextAnimator['values'];

const valueOf = (values: Values, key: ValueKey): number => values[key] ?? VALUES[key].fallback;

function lookOf(values: Values): PreviewLook {
  const move = `translate(${valueOf(values, 'x')}em, ${valueOf(values, 'y')}em)`;
  const turn = `rotate(${valueOf(values, 'rotation')}deg)`;
  const grow = `scale(${valueOf(values, 'scale')})`;
  return { opacity: valueOf(values, 'opacity'), transform: `${move} ${turn} ${grow}`, filter: `blur(${valueOf(values, 'blur')}px)` };
}

export const restLook = (): PreviewLook => lookOf({});

export const startLook = (values: Values): PreviewLook => lookOf(values);
