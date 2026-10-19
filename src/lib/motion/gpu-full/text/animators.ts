import { IDENTITY, mul2d, type Affine } from '../../affine';
import { ANIMATOR_UNITS, AnimatorUnit, type TextAnimator, type ValueKey } from '../../text-animators/model';
import { finestUnit } from '../../text-animators/render';
import { positionsOf, selection } from '../../text-animators/split';

export type Slot = Record<AnimatorUnit, number>;

export type Tint = { color: string; amount: number };

export type Look = { opacity: number; blur: number; turn: Affine; tint: Tint | null };

export type Animation = { finest: AnimatorUnit; isolates: boolean; at: (slot: Slot) => Look };

const ISOLATING: readonly ValueKey[] = ['x', 'y', 'rotation', 'scale', 'blur'];

const DEG = Math.PI / 180;

const rotation = (deg: number): Affine => [Math.cos(deg * DEG), Math.sin(deg * DEG), -Math.sin(deg * DEG), Math.cos(deg * DEG), 0, 0];

function turnOf(a: TextAnimator, amount: number): Affine {
  const { x, y, rotation: turn, scale } = a.values;
  const moved: Affine = [1, 0, 0, 1, amount * (x ?? 0), amount * (y ?? 0)];
  const grown = 1 + amount * ((scale ?? 1) - 1);
  return mul2d(mul2d(moved, rotation(amount * (turn ?? 0))), [grown, 0, 0, grown, 0, 0]);
}

export function animation(text: string, animators: readonly TextAnimator[]): Animation | null {
  if (!animators.length) {
    return null;
  }
  const finest = finestUnit(animators);
  const seed = animators.find((a) => a.unit === finest)!.seed;
  const positions = Object.fromEntries(ANIMATOR_UNITS.map((unit) => [unit, positionsOf(text, unit, unit === finest ? seed : null)])) as Record<AnimatorUnit, number[]>;
  const at = (slot: Slot): Look => {
    const look: Look = { opacity: 1, blur: 0, turn: IDENTITY, tint: null };
    for (const a of animators) {
      const amount = selection(a, positions[a.unit][slot[a.unit]] ?? 0);
      look.opacity *= 1 - amount * (1 - (a.values.opacity ?? 1));
      look.blur += amount * (a.values.blur ?? 0);
      look.turn = mul2d(look.turn, turnOf(a, amount));
      look.tint = a.values.color === undefined ? look.tint : { color: a.values.color, amount };
    }
    return look;
  };
  return { finest, isolates: animators.some((a) => ISOLATING.some((k) => a.values[k] !== undefined)), at };
}
