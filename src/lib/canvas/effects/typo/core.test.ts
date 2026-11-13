import { describe, expect, it } from 'vitest';
import { cellStats, hexRgb, legible, parseWords, phase, quantise, tick, tone } from './core';
import { makePixels } from '../test-helpers';

describe('typo core', () => {
	it('parses a word list on commas, spaces and new lines, dropping non printable characters', () => {
		expect(parseWords('token, write\nscope  é', 'x')).toEqual(['token', 'write', 'scope']);
	});

	it('falls back to the default words when the text is empty', () => {
		expect(parseWords('  ', 'a b')).toEqual(['a', 'b']);
	});

	it('reads a hex colour, or keeps the fallback for anything else', () => {
		expect(hexRgb('#ff5100', [0, 0, 0])).toEqual([255, 81, 0]);
		expect(hexRgb('orange', [1, 2, 3])).toEqual([1, 2, 3]);
	});

	it('maps luminance to brightness around the threshold, steeper with contrast', () => {
		expect(tone(0.4, 0.4, 2)).toBe(0.5);
		expect(tone(0.5, 0.4, 2)).toBeCloseTo(0.7);
		expect(tone(0.5, 0.4, 4)).toBeCloseTo(0.9);
		expect(tone(1, 0.4, 4)).toBe(1);
		expect(tone(0, 0.4, 4)).toBe(0);
	});

	it('quantises every channel to the palette levels', () => {
		expect(quantise([10, 130, 250], 2)).toEqual([0, 255, 255]);
		expect(quantise([100, 130, 250], 3)).toEqual([128, 128, 255]);
	});

	it('pushes a dark tint lighter and a light tint darker for legibility', () => {
		expect(legible([0, 0, 0], 0.5)).toEqual([128, 128, 128]);
		expect(legible([255, 255, 255], 0.5)).toEqual([128, 128, 128]);
	});

	it('loops: time and time plus one loop give the same phase and tick', () => {
		expect(phase(1.25, 4)).toBeCloseTo(phase(5.25, 4));
		expect(tick(1.25, 3, 4)).toBe(tick(5.25, 3, 4));
		expect(tick(9, 0, 4)).toBe(0);
	});

	it('measures a flat cell as zero contrast and an edge as high contrast', () => {
		const flat = makePixels(8, 8, () => [120, 120, 120, 255]);
		const edge = makePixels(8, 8, (x) => (x < 4 ? [0, 0, 0, 255] : [255, 255, 255, 255]));

		expect(cellStats(flat, 0, 0, 8, 8).contrast).toBe(0);
		expect(cellStats(edge, 0, 0, 8, 8).contrast).toBeGreaterThan(0.9);
	});
});
