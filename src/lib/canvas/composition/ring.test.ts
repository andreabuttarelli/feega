import { describe, expect, it } from 'vitest';
import { LAYOUTS, instanceCountFor, layoutAt } from './index';
import { RING_NUMBER_KEYS, params } from './ring';

describe('the ring layout', () => {
	it('is a looping layout whose numbers are its params', () => {
		expect(LAYOUTS.ring.motion).toBe('cycle');
		expect(params.map((p) => p.name)).toEqual(expect.arrayContaining([...RING_NUMBER_KEYS, 'count', 'turns', 'direction']));
	});

	it('fills the ring with count cards', () => {
		expect(instanceCountFor('ring', 2, { count: 7 })).toBe(7);
	});

	it('loops: the end of the cycle is its start', () => {
		const start = layoutAt('ring', 6, {}, 0);
		const end = layoutAt('ring', 6, {}, 1);

		start.forEach((t, i) => {
			expect(end[i].position.x).toBeCloseTo(t.position.x);
			expect(end[i].position.z).toBeCloseTo(t.position.z);
		});
	});

	it('bends every card around the ring radius', () => {
		const [card] = layoutAt('ring', 6, { tiltX: 0, tiltZ: 0 }, 0);
		const radius = Math.hypot(card.position.x, card.position.z);

		expect(card.bend).toBeCloseTo(radius);
		expect(card.width).toBeLessThan((radius * Math.PI * 2) / 6);
	});

	it('rounds the cards by the corner radius', () => {
		const [card] = layoutAt('ring', 6, { cornerRadius: 40, cardHeight: 0.4 }, 0);

		expect(card.corner).toBeGreaterThan(0);
		expect(layoutAt('ring', 6, { cornerRadius: 0 }, 0)[0].corner).toBe(0);
	});

	it('dims the cards facing away', () => {
		const cards = layoutAt('ring', 6, { tiltX: 0, tiltZ: 0, backOpacity: 0.3 }, 0);

		expect(cards[0].opacity).toBe(1);
		expect(cards[3].opacity).toBeCloseTo(0.3);
	});
});
