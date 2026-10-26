import { describe, expect, it } from 'vitest';
import { apply } from './colour-grade';
import { makePixels, pixelAt } from './test-helpers';

describe('colour grade apply', () => {
	const grey = makePixels(1, 1, () => [100, 100, 100, 255]);

	it('leaves the picture alone at the defaults', () => {
		expect(pixelAt(apply(grey, { brightness: 0, contrast: 1, temperature: 0 }), 0, 0)).toEqual([100, 100, 100, 255]);
	});

	it('brightens by the given amount', () => {
		expect(pixelAt(apply(grey, { brightness: 50, contrast: 1, temperature: 0 }), 0, 0)).toEqual([150, 150, 150, 255]);
	});

	it('warms by raising red and lowering blue', () => {
		const [r, , b] = pixelAt(apply(grey, { brightness: 0, contrast: 1, temperature: 40 }), 0, 0);
		expect(r).toBeGreaterThan(100);
		expect(b).toBeLessThan(100);
	});

	it('pushes values away from mid grey with contrast', () => {
		expect(pixelAt(apply(grey, { brightness: 0, contrast: 2, temperature: 0 }), 0, 0)[0]).toBe(72);
	});
});
