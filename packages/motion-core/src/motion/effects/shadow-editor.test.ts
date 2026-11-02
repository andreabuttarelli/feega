import { describe, expect, it } from 'vitest';
import { EFFECT_SEED, EffectKind, defaultValues, editedParams, isFlag } from './registry';

const keys = (kind: EffectKind, values: Record<string, number | string>) => editedParams(kind, values).map((p) => p.key);

describe('the drop shadow editor', () => {
  it('a shadow added from Properties starts like Figma: X 0, Y 4, blur 4, no distance', () => {
    expect(EFFECT_SEED[EffectKind.DropShadow]).toMatchObject({ distance: 0, x: 0, y: 4, blur: 4 });
  });

  it('edits one model: X, Y, blur, spread, colour, never distance and angle on top', () => {
    const shown = keys(EffectKind.DropShadow, { ...defaultValues(EffectKind.DropShadow), ...EFFECT_SEED[EffectKind.DropShadow] });
    expect(shown).toEqual(expect.arrayContaining(['x', 'y', 'blur', 'spread', 'color']));
    expect(shown).not.toContain('distance');
    expect(shown).not.toContain('angle');
  });

  it('a shadow made with a distance keeps its distance and angle rows, so it can be undone', () => {
    expect(keys(EffectKind.DropShadow, { distance: 16, angle: 135 })).toEqual(expect.arrayContaining(['distance', 'angle']));
  });

  it('Show behind is a toggle, not a number', () => {
    expect(isFlag(EffectKind.DropShadow, 'behind')).toBe(true);
    expect(isFlag(EffectKind.DropShadow, 'blur')).toBe(false);
  });

  it('softness reads Blur, as in every other design tool', () => {
    expect(editedParams(EffectKind.DropShadow, {}).find((p) => p.key === 'blur')?.label).toBe('Blur');
  });
});
