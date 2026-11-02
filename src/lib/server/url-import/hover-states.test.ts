import { describe, expect, it } from 'vitest';
import { Ease } from '@feega/motion-core/motion/design';
import { ElementState } from '@feega/motion-core/motion/states/model';
import type { RestNode } from '$lib/server/figma/rest-message';
import { withHoverStates } from './hover-states';

const frame = (hover: RestNode['hover'], over: Partial<RestNode> = {}): RestNode => ({ id: 'b', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 40 }, fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1, a: 1 } }], hover, ...over });

describe('a hover read from the page becomes an element state', () => {
  it('a frame that darkens on hover gets a fill override with the page transition', () => {
    const made = withHoverStates(frame({ fill: 'rgb(0, 51, 153)', durationMs: 150, easing: 'ease-out' }));

    expect(made.hover).toBeUndefined();
    expect(made.behaviour?.states).toEqual([{ state: ElementState.Hover, overrides: { fill: '#003399' }, transition: { easing: [0, 0, 0.58, 1], durationMs: 150 } }]);
  });

  it('a text that recolours fills itself; a cubic-bezier and a scale come along', () => {
    const made = withHoverStates(frame({ color: 'rgba(255, 0, 0, 0.5)', scale: 1.05, durationMs: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' }, { type: 'TEXT' }));

    expect(made.behaviour?.states?.[0]).toMatchObject({ overrides: { fill: '#ff000080', scale: 1.05 }, transition: { easing: [0.2, 0, 0, 1], durationMs: 200 } });
  });

  it('a colour change a layer cannot show is dropped, and an empty hover leaves no state', () => {
    const made = withHoverStates(frame({ stroke: 'rgb(0, 0, 0)', durationMs: 0, easing: 'linear' }));

    expect(made.behaviour).toBeUndefined();
  });

  it('the page default timing reads as the house standard ease', () => {
    const made = withHoverStates({ ...frame(undefined), children: [frame({ opacity: 0.8, durationMs: 0, easing: 'step-end' }, { id: 'c' })] });

    expect(made.children?.[0].behaviour?.states?.[0].transition).toEqual({ easing: Ease.Standard, durationMs: 0 });
  });
});
