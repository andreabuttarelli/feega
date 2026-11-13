import { describe, expect, it } from 'vitest';
import { makePixels, pixelAt } from '../test-helpers';
import type { Pixels } from '../types';
import { apply as weave } from './word-weave';
import { apply as field } from './word-field';
import { apply as tiles } from './glyph-tiles';
import { apply as silhouette } from './word-silhouette';

const SIZE = 216;

function disk(): Pixels {
	return makePixels(SIZE, SIZE, (x, y) => {
		const inside = (x - SIZE / 2) ** 2 + (y - SIZE / 2) ** 2 < (SIZE / 3) ** 2;
		return inside ? [235, 225, 210, 255] : [20, 40, 30, 255];
	});
}

function meanLuminance(pixels: Pixels, x0: number, y0: number, w: number, h: number): number {
	let sum = 0;
	for (let y = y0; y < y0 + h; y++) {
		for (let x = x0; x < x0 + w; x++) {
			const [r, g, b] = pixelAt(pixels, x, y);
			sum += 0.299 * r + 0.587 * g + 0.114 * b;
		}
	}
	return sum / (w * h);
}

function hasColour(pixels: Pixels, rgb: [number, number, number]): boolean {
	for (let i = 0; i < pixels.data.length; i += 4) {
		if (pixels.data[i] === rgb[0] && pixels.data[i + 1] === rgb[1] && pixels.data[i + 2] === rgb[2]) {
			return true;
		}
	}
	return false;
}

const CENTRE = SIZE / 2 - 20;
const CORNER = 4;

describe('typographic effects on a fixture', () => {
	it('word weave leaves flat areas untouched and writes on the edges', () => {
		const source = disk();
		const out = weave(source, { text: 'feega', cellSize: 60, threshold: 20, density: 100, accentShare: 0 });

		expect(Array.from(out.data.slice(0, SIZE * 4 * 10))).toEqual(Array.from(source.data.slice(0, SIZE * 4 * 10)));
		expect(Array.from(out.data)).not.toEqual(Array.from(source.data));
	});

	it('word field draws the subject brighter than the background, on the chosen background colour', () => {
		const out = field(disk(), { cellSize: 60, accentMode: 'off', background: '#101010', floor: 5 });

		expect(meanLuminance(out, CENTRE, CENTRE, 40, 40)).toBeGreaterThan(meanLuminance(out, CORNER, CORNER, 40, 40) + 10);
		expect(hasColour(out, [16, 16, 16])).toBe(true);
	});

	it('word field paints accent blocks in the accent colour on the subject', () => {
		const out = field(disk(), { cellSize: 60, accentMode: 'column', accentWidth: 30, accent: '#ff5100' });

		expect(hasColour(out, [255, 81, 0])).toBe(true);
	});

	it('glyph tiles quantise the subject, leave dark areas as empty tiles and draw the accent line', () => {
		const out = tiles(disk(), { cellSize: 200, gap: 0, radius: 0, levels: 2, threshold: 30, background: '#1c1d1f', labelCount: 0, accent: '#ff5100' });

		expect(pixelAt(out, CORNER, CORNER).slice(0, 3)).toEqual([36, 37, 39]);
		expect(hasColour(out, [255, 255, 255]) || hasColour(out, [255, 81, 0])).toBe(true);
	});

	it('glyph tiles put label chips on top', () => {
		const out = tiles(disk(), { cellSize: 200, labelCount: 3, labels: 'DATA' });

		expect(hasColour(out, [17, 18, 20])).toBe(true);
	});

	it('word silhouette writes the subject in bright words over a quiet field', () => {
		const out = silhouette(disk(), { cellSize: 60, backgroundMode: 'set', background: '#3e5a4f', inner: 101 });

		expect(meanLuminance(out, CENTRE, CENTRE, 40, 40)).toBeGreaterThan(meanLuminance(out, CORNER, CORNER, 40, 40) + 10);
	});

	it('word silhouette reads the shape from transparency', () => {
		const cutout = makePixels(SIZE, SIZE, (x) => (x < SIZE / 2 ? [0, 0, 0, 255] : [0, 0, 0, 0]));
		const out = silhouette(cutout, { cellSize: 60, mask: 'alpha', backgroundMode: 'set', inner: 101 });

		expect(meanLuminance(out, 0, 0, SIZE / 2, SIZE)).toBeGreaterThan(meanLuminance(out, SIZE / 2, 0, SIZE / 2, SIZE) + 10);
	});

	it('every look loops: one loop later is the same frame', () => {
		for (const look of [weave, field, tiles, silhouette]) {
			const params = { cellSize: 60, loop: 2, rate: 3, scroll: 1 };
			expect(Array.from(look(disk(), params, 0.7).data)).toEqual(Array.from(look(disk(), params, 2.7).data));
		}
	});

	it('animates: a later moment of the loop is a different frame', () => {
		for (const look of [weave, field, tiles, silhouette]) {
			const params = { cellSize: 60, loop: 2, rate: 3, scroll: 1, density: 100, threshold: 10 };
			expect(Array.from(look(disk(), params, 0).data)).not.toEqual(Array.from(look(disk(), params, 1).data));
		}
	});

	it('on a steady video the words hold still from frame to frame', () => {
		for (const look of [field, silhouette, tiles]) {
			const state = {};
			const params = { cellSize: 60, rate: 0, accentMode: 'off', accentLine: 'off' };
			look(disk(), params, 0, state);
			const settled = look(disk(), params, 1 / 30, state);
			expect(Array.from(look(disk(), params, 0.5, state).data), String(look)).toEqual(Array.from(settled.data));
		}
	});

	it('a change in one part of the video changes words only there', () => {
		const state = {};
		const params = { cellSize: 40, rate: 0, fade: 0, accentMode: 'off', follow: 'off' };
		const before = field(disk(), params, 0, state);
		const changed = makePixels(SIZE, SIZE, (x, y) => (x > SIZE - 60 && y > SIZE - 60 ? [255, 255, 255, 255] : pixelAt(disk(), x, y)));
		const after = field(changed, params, 1, state);
		expect(Array.from(after.data.slice(0, SIZE * 4 * 40))).toEqual(Array.from(before.data.slice(0, SIZE * 4 * 40)));
	});
});
