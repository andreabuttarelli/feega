import { describe, expect, it } from 'vitest';
import { apply } from './chroma-key';
import { makePixels, pixelAt } from './test-helpers';

describe('chroma key apply', () => {
	it('makes the key colour transparent and keeps the rest', () => {
		const row = makePixels(2, 1, (x) => (x === 0 ? [0, 255, 0, 255] : [200, 30, 30, 255]));
		const out = apply(row, { color: '#00ff00', tolerance: 40 });

		expect(pixelAt(out, 0, 0)[3]).toBe(0);
		expect(pixelAt(out, 1, 0)).toEqual([200, 30, 30, 255]);
	});

	it('keeps colours that are outside the tolerance', () => {
		const near = makePixels(1, 1, () => [30, 225, 30, 255]);

		expect(pixelAt(apply(near, { color: '#00ff00', tolerance: 0 }), 0, 0)[3]).toBe(255);
		expect(pixelAt(apply(near, { color: '#00ff00', tolerance: 60 }), 0, 0)[3]).toBe(0);
	});
});
