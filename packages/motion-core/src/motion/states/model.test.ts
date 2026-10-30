import { describe, expect, it } from 'vitest';
import { ElementState, mixState, resolveState, statesSchema } from './model';

const clip = { transform: { opacity: 1 }, props: { fill: '#111111', stroke: '#000000' }, states: statesSchema.parse([{ state: ElementState.Hover, overrides: { opacity: 0.6, fill: '#ff0000' } }]) };

describe('element states', () => {
  it('the default state leaves the element as drawn', () => {
    expect(resolveState(clip, ElementState.Default)).toEqual({ transform: clip.transform, props: clip.props });
  });

  it('a state routes transform keys to transform and the rest to props', () => {
    expect(resolveState(clip, ElementState.Hover)).toEqual({ transform: { opacity: 0.6 }, props: { fill: '#ff0000', stroke: '#000000' } });
  });

  it('a state the element does not define falls back to default', () => {
    expect(resolveState(clip, ElementState.Pressed).props.fill).toBe('#111111');
  });

  it('every row gets a transition with easing and duration', () => {
    const [row] = statesSchema.parse([{ state: ElementState.Hover, overrides: { opacity: 0.5 } }]);
    expect(row.transition).toEqual({ easing: 'standard', durationMs: 200 });
  });

  it('refuses two rows for the same state and an unknown override', () => {
    expect(statesSchema.safeParse([{ state: 'hover', overrides: {} }, { state: 'hover', overrides: {} }]).success).toBe(false);
    expect(statesSchema.safeParse([{ state: 'hover', overrides: { width: 3 } }]).success).toBe(false);
  });
});

describe('mixing into a state', () => {
  it('halfway mixes numbers and colours between default and the state', () => {
    const half = mixState(clip, ElementState.Hover, 0.5);
    expect(half.transform.opacity).toBeCloseTo(0.8);
    expect(half.props.fill).toBe('#880909');
  });

  it('amount 1 is the resolved state and 0 is the element as drawn', () => {
    expect(mixState(clip, ElementState.Hover, 1)).toEqual(resolveState(clip, ElementState.Hover));
    expect(mixState(clip, ElementState.Hover, 0)).toEqual(resolveState(clip, ElementState.Default));
  });
});
