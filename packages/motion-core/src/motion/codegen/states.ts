import type { MotionClip } from '../doc';
import { EASE_BEZIER } from '../keyframes';
import { ElementState, OVERRIDE_KEYS, type OverrideKey, type StateRow } from '../states/model';
import { round } from './ease';
import type { Rule } from './ir';

export enum StatePaint {
  Box = 'box',
  Text = 'text'
}

export type StateStyle = { base: Rule[]; rows: { pseudo: string; rules: Rule[] }[] };

const PSEUDO: Record<StateRow['state'], string> = {
  [ElementState.Hover]: ':hover',
  [ElementState.Pressed]: ':active',
  [ElementState.Focus]: ':focus-visible'
};

const ORDER: StateRow['state'][] = [ElementState.Hover, ElementState.Focus, ElementState.Pressed];

const px = (v: number) => `${round(v)}px`;

const CSS_OF: Record<OverrideKey, (value: number | string, paint: StatePaint, unit: number) => Rule> = {
  opacity: (v) => ['opacity', String(v)],
  scale: (v) => ['scale', String(v)],
  rotateZ: (v) => ['rotate', `${v}deg`],
  blur: (v) => ['filter', `blur(${v}px)`],
  fill: (v, paint) => [paint === StatePaint.Text ? 'color' : 'background-color', String(v)],
  stroke: (v, paint) => [paint === StatePaint.Text ? '-webkit-text-stroke-color' : 'border-color', String(v)],
  strokeWidth: (v, paint, unit) => [paint === StatePaint.Text ? '-webkit-text-stroke-width' : 'border-width', px(Number(v) * unit)],
  cornerRadius: (v) => ['border-radius', px(Number(v))]
};

const curve = (row: StateRow) => `${row.transition.durationMs}ms cubic-bezier(${EASE_BEZIER[row.transition.easing].map(round).join(', ')})`;

const transition = (rules: Rule[], row: StateRow): Rule => ['transition', rules.map(([p]) => `${p} ${curve(row)}`).join(', ')];

export const paintOf = (clip: MotionClip): StatePaint => (clip.props.text !== undefined || clip.props.title !== undefined ? StatePaint.Text : StatePaint.Box);

export function stateStyleOf(clip: MotionClip, unit: number): StateStyle | undefined {
  const rows = ORDER.flatMap((state) => clip.states?.filter((r) => r.state === state) ?? []);
  if (!rows.length) {
    return undefined;
  }

  const paint = paintOf(clip);
  const rulesOf = (row: StateRow): Rule[] => OVERRIDE_KEYS.flatMap((k) => (row.overrides[k] === undefined ? [] : [CSS_OF[k](row.overrides[k]!, paint, unit)]));
  const styled = rows.map((row) => ({ row, rules: rulesOf(row) })).filter((s) => s.rules.length);
  if (!styled.length) {
    return undefined;
  }

  const touched = [...new Map(styled.flatMap((s) => s.rules).map((r) => [r[0], r] as const)).values()];
  return {
    base: [transition(touched, styled[0].row)],
    rows: styled.map(({ row, rules }) => ({ pseudo: PSEUDO[row.state], rules: [...rules, transition(rules, row)] }))
  };
}
