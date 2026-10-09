import { describe, expect, it } from 'vitest';
import { STYLE_EASES } from '$lib/motion/style-model';
import { LAYOUTS } from './index';
import { easeCurve } from '$lib/motion/keyframes';
import { SLIDER_VARIANTS, instances, transforms } from './slider';
import type { LayoutParams } from './types';

const MEDIA = 5;
const FRAME = { __frameWidth: 6.3, __frameHeight: 11.2 };
const MOVE = STYLE_EASES['apple-minimal'].move;

function at(params: LayoutParams, t: number) {
	const all = { ...FRAME, ...params };
	const count = instances(MEDIA, all);
	return transforms(count, all, t);
}

describe('slider', () => {
	it('offers slide, crossfade, push and peek variants', () => {
		expect(SLIDER_VARIANTS).toEqual(['slide-x', 'slide-y', 'crossfade', 'push', 'peek']);
	});

	for (const variant of SLIDER_VARIANTS) {
		it(`${variant} holds one media in the centre, whole and in front`, () => {
			const cards = at({ variant, indicators: 'none' }, 0.01);
			const front = cards.filter((card) => (card.opacity ?? 1) > 0.99);

			expect(front).toHaveLength(1);
			expect(front[0].position.x).toBeCloseTo(0, 5);
			expect(front[0].position.y).toBeCloseTo(0, 5);
			expect(front[0].scale.x).toBeLessThanOrEqual(FRAME.__frameWidth);
		});

		it(`${variant} moves on to the next media within one step`, () => {
			const step = 1 / MEDIA;
			const next = at({ variant, indicators: 'none' }, step + 0.001);
			const front = next.findIndex((card) => (card.opacity ?? 1) > 0.99 && Math.abs(card.position.x) < 1e-3 && Math.abs(card.position.y) < 1e-3);

			expect(front).toBe(1);
		});
	}

	it('peek keeps the neighbours partly in view at the sides', () => {
		const cards = at({ variant: 'peek', indicators: 'none' }, 0.01);
		const sides = cards.filter((card) => (card.opacity ?? 1) > 0.1 && Math.abs(card.position.x) > 0.1);
		const half = FRAME.__frameWidth / 2;

		expect(sides.length).toBe(2);
		for (const side of sides) {
			expect(Math.abs(side.position.x) - side.scale.x / 2).toBeLessThan(half);
		}
	});

	it('draws one dot per media, the current one brightest', () => {
		const params = { ...FRAME, indicators: 'dots' };
		const count = instances(MEDIA, params);
		const marks = LAYOUTS.slider.solids?.(count, params) ?? 0;
		const dots = transforms(count, params, 0.01).slice(count - marks);

		expect(marks).toBe(MEDIA);
		expect(dots[0].opacity).toBeGreaterThan(dots[1].opacity ?? 1);
	});

	it('fills a progress bar across each hold', () => {
		const params = { ...FRAME, indicators: 'bar' };
		const count = instances(MEDIA, params);
		const marks = LAYOUTS.slider.solids?.(count, params) ?? 0;
		const early = transforms(count, params, 0.02).slice(count - marks);
		const late = transforms(count, params, 0.15).slice(count - marks);

		expect(marks).toBe(2);
		expect(late[1].scale.x).toBeGreaterThan(early[1].scale.x);
	});

	it('has no indicators unless asked', () => {
		const count = instances(MEDIA, FRAME);
		expect(LAYOUTS.slider.solids?.(count, FRAME) ?? 0).toBe(0);
	});

	it('moves on the house move ease', () => {
		const ease = easeCurve(MOVE);
		expect(ease(0.5)).toBeCloseTo(0.5, 3);
		expect(ease(0.25)).toBeLessThan(0.15);
		expect(ease(0)).toBe(0);
		expect(ease(1)).toBe(1);
	});
});
