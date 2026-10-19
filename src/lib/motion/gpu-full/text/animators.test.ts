import { describe, expect, it } from 'vitest';
import { animatorSchema, AnimatorUnit, SelectorShape, type TextAnimator } from '../../text-animators/model';
import { charPositions } from '../../text-animators/split';
import { animation, type Slot } from './animators';

const animator = (input: Record<string, unknown>): TextAnimator => animatorSchema.parse({ id: 'a', unit: AnimatorUnit.Char, shape: SelectorShape.Square, ...input });
const slot = (char: number, word = 0, line = 0): Slot => ({ [AnimatorUnit.Char]: char, [AnimatorUnit.Word]: word, [AnimatorUnit.Line]: line });

describe('animation', () => {
  it('is absent without animators', () => {
    expect(animation('ab', [])).toBeNull();
  });

  it('applies a value only to the units its range selects', () => {
    const run = animation('ab', [animator({ start: 0, end: 50, values: { opacity: 0 } })])!;

    expect(run.at(slot(0)).opacity).toBeCloseTo(0);
    expect(run.at(slot(1)).opacity).toBeCloseTo(1);
  });

  it('composes offset in em, rotation and scale in that order', () => {
    const run = animation('a', [animator({ values: { x: 1, rotation: 90, scale: 2 } })])!;
    const turn = run.at(slot(0)).turn;

    expect(turn.map((n) => Math.round(n * 1000) / 1000 + 0)).toEqual([0, 2, -2, 0, 1, 0]);
  });

  it('selects a coarser unit by that unit position', () => {
    const run = animation('ab cd', [animator({ id: 'c', values: { blur: 2 } }), animator({ id: 'w', unit: AnimatorUnit.Word, end: 50, values: { opacity: 0 } })])!;

    expect(run.finest).toBe(AnimatorUnit.Char);
    expect(run.at(slot(1, 0)).opacity).toBeCloseTo(0);
    expect(run.at(slot(2, 1)).opacity).toBeCloseTo(1);
    expect(run.at(slot(2, 1)).blur).toBeCloseTo(2);
  });

  it('shuffles the finest unit with its seed exactly like the page', () => {
    const run = animation('abcdef', [animator({ seed: 7, end: 50, values: { opacity: 0 } })])!;
    const hidden = charPositions('abcdef', 7).map((p) => (p < 0.5 ? 0 : 1));

    expect([0, 1, 2, 3, 4, 5].map((i) => Math.round(run.at(slot(i)).opacity))).toEqual(hidden);
  });

  it('sums blur and keeps the last colour, mixed by its selection', () => {
    const run = animation('a', [animator({ id: 'a', values: { blur: 2, color: '#ff0000' } }), animator({ id: 'b', shape: SelectorShape.Ramp, softness: 1, start: 0, end: 200, values: { blur: 3, color: '#0000ff' } })])!;
    const look = run.at(slot(0));

    expect(look.blur).toBeCloseTo(2 + 3 * 0.5);
    expect(look.tint).toEqual({ color: '#0000ff', amount: 0.5 });
  });
});
