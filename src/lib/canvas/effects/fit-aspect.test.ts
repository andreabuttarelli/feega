import { describe, expect, it } from 'vitest';
import { apply } from './fit-aspect';
import { makePixels, pixelAt } from './test-helpers';

const red = (w: number, h: number) => makePixels(w, h, () => [255, 0, 0, 255]);

describe('fit aspect apply', () => {
	it('pads a wide picture to a square with the background', () => {
		const out = apply(red(4, 2), { ratio: '1:1', mode: 'pad', background: '#000000' });

		expect([out.width, out.height]).toEqual([4, 4]);
		expect(pixelAt(out, 0, 0)).toEqual([0, 0, 0, 255]);
		expect(pixelAt(out, 0, 1)).toEqual([255, 0, 0, 255]);
	});

	it('crops a wide picture to a square', () => {
		const out = apply(red(4, 2), { ratio: '1:1', mode: 'crop', background: '#000000' });

		expect([out.width, out.height]).toEqual([2, 2]);
		expect(pixelAt(out, 0, 0)).toEqual([255, 0, 0, 255]);
	});

	it('keeps a picture already at the ratio', () => {
		const out = apply(red(4, 4), { ratio: '1:1', mode: 'pad', background: '#000000' });

		expect([out.width, out.height]).toEqual([4, 4]);
	});

	it('pads to 9:16', () => {
		const out = apply(red(18, 18), { ratio: '9:16', mode: 'pad', background: '#ffffff' });

		expect([out.width, out.height]).toEqual([18, 32]);
	});
});
