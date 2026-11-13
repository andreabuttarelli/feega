import { ATLAS } from './glyph-atlas';
import type { Pixels } from '../types';

export type Rgb = [number, number, number];

export type CellStats = { color: Rgb; alpha: number; luminance: number; contrast: number };

export type Params = Record<string, number | string>;

const MAX_WORDS = 64;
const MAX_WORD_LENGTH = 24;
const PRINTABLE = /[^\x20-\x7e]/g;
const SEPARATORS = /[\s,;]+/;
const LUMA: Rgb = [0.299, 0.587, 0.114];
const SAMPLE_STEP = 2;
const MAX_CONTRAST = 0.5;

let alphaBytes: Uint8Array | null = null;

function atlasAlpha(): Uint8Array {
	alphaBytes ??= Uint8Array.from(atob(ATLAS.alpha), (c) => c.charCodeAt(0));
	return alphaBytes;
}

export function parseWords(text: unknown, fallback: string): string[] {
	const words = String(text ?? '')
		.split(SEPARATORS)
		.map((word) => word.replace(PRINTABLE, '').slice(0, MAX_WORD_LENGTH))
		.filter((word) => word.length > 0)
		.slice(0, MAX_WORDS);

	return words.length > 0 ? words : fallback.split(SEPARATORS);
}

export function hexRgb(hex: unknown, fallback: Rgb): Rgb {
	const match = /^#([0-9a-f]{6})$/i.exec(String(hex ?? ''));
	if (!match) {
		return fallback;
	}

	const value = parseInt(match[1], 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function numberOf(params: Params, name: string, fallback: number): number {
	const value = Number(params[name]);
	return Number.isFinite(value) ? value : fallback;
}

export function luminance(rgb: Rgb): number {
	return (rgb[0] * LUMA[0] + rgb[1] * LUMA[1] + rgb[2] * LUMA[2]) / 255;
}

export function tone(lum: number, threshold: number, contrast: number): number {
	return Math.min(1, Math.max(0, (lum - threshold) * contrast + 0.5));
}

export function quantise(rgb: Rgb, levels: number): Rgb {
	const steps = Math.max(1, Math.round(levels) - 1);
	return rgb.map((c) => Math.round((Math.round((c / 255) * steps) / steps) * 255)) as Rgb;
}

export function legible(rgb: Rgb, amount: number): Rgb {
	const target = luminance(rgb) < 0.5 ? 255 : 0;
	return rgb.map((c) => Math.round(c + (target - c) * amount)) as Rgb;
}

export function hash(a: number, b: number, c: number): number {
	let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}

export function phase(time: number, loop: number): number {
	const period = Math.max(0.1, loop);
	return (((time % period) + period) % period) / period;
}

export function tick(time: number, rate: number, loop: number): number {
	const perLoop = Math.max(1, Math.round(loop * rate));
	return rate <= 0 ? 0 : Math.floor(phase(time, loop) * perLoop);
}

export function cellStats(pixels: Pixels, x0: number, y0: number, w: number, h: number): CellStats {
	const { width, height, data } = pixels;
	const x1 = Math.min(width, x0 + w);
	const y1 = Math.min(height, y0 + h);
	let r = 0;
	let g = 0;
	let b = 0;
	let a = 0;
	let sum = 0;
	let squares = 0;
	let count = 0;

	for (let y = y0; y < y1; y += SAMPLE_STEP) {
		for (let x = x0; x < x1; x += SAMPLE_STEP) {
			const i = (y * width + x) * 4;
			const lum = (data[i] * LUMA[0] + data[i + 1] * LUMA[1] + data[i + 2] * LUMA[2]) / 255;
			r += data[i];
			g += data[i + 1];
			b += data[i + 2];
			a += data[i + 3];
			sum += lum;
			squares += lum * lum;
			count++;
		}
	}

	if (count === 0) {
		return { color: [0, 0, 0], alpha: 0, luminance: 0, contrast: 0 };
	}

	const mean = sum / count;
	const deviation = Math.sqrt(Math.max(0, squares / count - mean * mean));
	return {
		color: [r / count, g / count, b / count],
		alpha: a / count,
		luminance: mean,
		contrast: Math.min(1, deviation / MAX_CONTRAST)
	};
}

export function fill(pixels: Pixels, rgb: Rgb): Pixels {
	const data = new Uint8ClampedArray(pixels.width * pixels.height * 4);

	for (let i = 0; i < data.length; i += 4) {
		data[i] = rgb[0];
		data[i + 1] = rgb[1];
		data[i + 2] = rgb[2];
		data[i + 3] = 255;
	}

	return { width: pixels.width, height: pixels.height, data };
}

export function rect(out: Pixels, x0: number, y0: number, w: number, h: number, rgb: Rgb, radius = 0): void {
	const x1 = Math.min(out.width, x0 + w);
	const y1 = Math.min(out.height, y0 + h);
	const r = Math.min(radius, w / 2, h / 2);

	for (let y = Math.max(0, y0); y < y1; y++) {
		for (let x = Math.max(0, x0); x < x1; x++) {
			if (r > 0 && outsideCorner(x - x0 + 0.5, y - y0 + 0.5, w, h, r)) {
				continue;
			}

			const i = (y * out.width + x) * 4;
			out.data[i] = rgb[0];
			out.data[i + 1] = rgb[1];
			out.data[i + 2] = rgb[2];
			out.data[i + 3] = 255;
		}
	}
}

function outsideCorner(x: number, y: number, w: number, h: number, r: number): boolean {
	const cx = Math.min(Math.max(x, r), w - r);
	const cy = Math.min(Math.max(y, r), h - r);
	return (x - cx) ** 2 + (y - cy) ** 2 > r * r;
}

export function glyph(out: Pixels, char: string, x0: number, y0: number, w: number, h: number, rgb: Rgb, opacity: number): void {
	const code = char.charCodeAt(0);
	if (code <= ATLAS.first || code > ATLAS.last || opacity <= 0) {
		return;
	}

	const alpha = atlasAlpha();
	const stride = ATLAS.cellWidth * (ATLAS.last - ATLAS.first + 1);
	const originX = (code - ATLAS.first) * ATLAS.cellWidth;
	const x1 = Math.min(out.width, x0 + w);
	const y1 = Math.min(out.height, y0 + h);

	for (let y = Math.max(0, y0); y < y1; y++) {
		const row = Math.floor(((y - y0) / h) * ATLAS.cellHeight) * stride + originX;

		for (let x = Math.max(0, x0); x < x1; x++) {
			const coverage = alpha[row + Math.floor(((x - x0) / w) * ATLAS.cellWidth)];
			if (coverage === 0) {
				continue;
			}

			const a = (coverage / 255) * opacity;
			const i = (y * out.width + x) * 4;
			out.data[i] += (rgb[0] - out.data[i]) * a;
			out.data[i + 1] += (rgb[1] - out.data[i + 1]) * a;
			out.data[i + 2] += (rgb[2] - out.data[i + 2]) * a;
		}
	}
}

export const GLYPH_ASPECT = ATLAS.cellWidth / ATLAS.cellHeight;

export function rowStream(words: string[], row: number, seed: number, length = 8): string {
	const picked: string[] = [];

	for (let k = 0; k < length; k++) {
		picked.push(words[Math.floor(hash(row, k, seed) * words.length)]);
	}

	return picked.join(' ') + ' ';
}

export function scrolled(stream: string, column: number, shift: number): string {
	const period = stream.length;
	return stream[(((column + shift) % period) + period) % period];
}

export type Span = { start: number; end: number; text: string; index: number };

export function rowSpans(stream: string, columns: number, shift: number): Span[] {
	const spans: Span[] = [];
	let current: Span | null = null;

	for (let column = 0; column < columns; column++) {
		const char = scrolled(stream, column, shift);
		if (char === ' ') {
			current = null;
			continue;
		}

		if (!current) {
			current = { start: column, end: column, text: '', index: spans.length };
			spans.push(current);
		}

		current.end = column + 1;
		current.text += char;
	}

	return spans;
}

export function shuffledSeed(seed: number, row: number, slot: number, step: number, share: number): number {
	return hash(row, slot, seed + 7) < share ? seed + step * 101 : seed;
}

export type TextGrid = { charWidth: number; charHeight: number; columns: number; rows: number };

const REFERENCE_SIDE = 1080;

export function unit(pixels: Pixels): number {
	return Math.max(pixels.width, pixels.height) / REFERENCE_SIDE;
}

export function textGrid(pixels: Pixels, cellSize: number): TextGrid {
	const charHeight = Math.max(4, Math.round(cellSize * unit(pixels)));
	const charWidth = Math.max(3, Math.round(charHeight * GLYPH_ASPECT));
	return {
		charWidth,
		charHeight,
		columns: Math.ceil(pixels.width / charWidth),
		rows: Math.ceil(pixels.height / charHeight)
	};
}

export function spanStats(pixels: Pixels, grid: TextGrid, row: number, span: Span): CellStats {
	return cellStats(pixels, span.start * grid.charWidth, row * grid.charHeight, (span.end - span.start) * grid.charWidth, grid.charHeight);
}

export function sourceAverage(pixels: Pixels): Rgb {
	return cellStats(pixels, 0, 0, pixels.width, pixels.height).color;
}

export function copyOf(pixels: Pixels): Pixels {
	return { width: pixels.width, height: pixels.height, data: new Uint8ClampedArray(pixels.data) };
}
