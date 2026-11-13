import { BRAND_ORANGE, motionOf, motionParams, textParam } from './params';
import { fadeOf, gate, settleCell } from './temporal';
import { cellStats, copyOf, glyph, hash, hexRgb, legible, numberOf, parseWords, phase, scrolled, textGrid, type Params, type Rgb } from './core';
import type { EffectParam, Pixels } from '../types';

const DEFAULT_TEXT = 'feega';
const PERCENT = 100;
const MIN_RUN = 3;
const RUN_SPREAD = 9;
const ACCENT_MARGIN = 0.35;
const TRACKING_SPREAD = 0.6;
const NOISE = 0.1;
const ID_STRIDE = 7919;

export const WORD_WEAVE_PARAMS: EffectParam[] = [
	textParam(DEFAULT_TEXT),
	{ name: 'cellSize', label: 'Text size', kind: 'range', min: 8, max: 64, step: 1, default: 24 },
	{ name: 'threshold', label: 'Edge threshold', kind: 'range', min: 0, max: 100, step: 1, default: 12 },
	{ name: 'density', label: 'Density', kind: 'range', min: 0, max: 100, step: 1, default: 80 },
	{ name: 'legibility', label: 'Legibility', kind: 'range', min: 0, max: 100, step: 1, default: 55 },
	{ name: 'tracking', label: 'Tracking', kind: 'range', min: 0, max: 100, step: 1, default: 8 },
	{ name: 'accent', label: 'Accent colour', kind: 'color', default: BRAND_ORANGE },
	{ name: 'accentShare', label: 'Accent on strongest edges', kind: 'range', min: 0, max: 100, step: 1, default: 10 },
	...motionParams(NOISE, 0)
];

export function apply(pixels: Pixels, params: Params, time = 0, state?: Record<string, unknown>): Pixels {
	const out = copyOf(pixels);
	const word = parseWords(params.text, DEFAULT_TEXT).join('');
	const grid = textGrid(pixels, numberOf(params, 'cellSize', 24));
	const advance = Math.round(grid.charWidth * (1 + (numberOf(params, 'tracking', 8) / PERCENT) * TRACKING_SPREAD));
	const columns = Math.ceil(pixels.width / advance);
	const threshold = numberOf(params, 'threshold', 12) / PERCENT;
	const density = numberOf(params, 'density', 80) / PERCENT;
	const legibility = numberOf(params, 'legibility', 55) / PERCENT;
	const accent = hexRgb(params.accent, [255, 81, 0]);
	const accentShare = numberOf(params, 'accentShare', 10) / PERCENT;
	const seed = numberOf(params, 'seed', 1);
	const cycle = phase(time, numberOf(params, 'loop', 4));
	const scroll = Math.round(numberOf(params, 'scroll', 0));
	const motion = motionOf(pixels, params, time, state, NOISE);
	const panColumns = Math.floor(motion.pan.x / advance);
	const panRows = Math.floor(motion.pan.y / grid.charHeight);
	const offsetX = Math.round(motion.pan.x - panColumns * advance);
	const offsetY = Math.round(motion.pan.y - panRows * grid.charHeight);

	for (let screenRow = -1; screenRow <= grid.rows; screenRow++) {
		const worldRow = screenRow - panRows;
		const direction = worldRow % 2 === 0 ? 1 : -1;
		const shift = Math.floor(hash(worldRow, 0, seed) * word.length) + direction * Math.floor(cycle * word.length * scroll) - panColumns - 1;
		const run = MIN_RUN + Math.floor(hash(worldRow, 1, seed) * RUN_SPREAD);
		const y = screenRow * grid.charHeight + offsetY;
		if (y + grid.charHeight <= 0 || y >= pixels.height) {
			continue;
		}

		for (let first = -(((shift % run) + run) % run); first < columns + 2; first += run) {
			const runIndex = Math.floor((first + shift) / run);
			if (hash(worldRow, runIndex, seed * 31) >= density) {
				continue;
			}

			const x0 = (first - 1) * advance + offsetX;
			const left = Math.max(0, x0);
			const right = Math.min(pixels.width, x0 + run * advance);
			const top = Math.max(0, y);
			if (right <= left) {
				continue;
			}

			const stats = cellStats(pixels, left, top, right - left, Math.min(pixels.height, y + grid.charHeight) - top);
			const id = worldRow * ID_STRIDE + runIndex;
			const cell = settleCell(motion.memory, `${worldRow}:${runIndex}`, id, stats.luminance, motion.settle);
			const shown = gate(motion.memory, cell, stats.contrast, threshold, time);
			const appear = fadeOf(cell.shownAt, time, motion.settle.fade);
			const opacity = shown ? appear : 1 - appear;
			if (opacity <= 0) {
				continue;
			}

			const strong = stats.contrast > threshold + ACCENT_MARGIN && hash(worldRow, runIndex, seed + 3) < accentShare;
			for (let k = 0; k < run; k++) {
				const x = x0 + k * advance;
				if (x + advance <= 0 || x >= pixels.width) {
					continue;
				}
				const ink: Rgb = strong ? accent : legible(cellStats(pixels, Math.max(0, x), top, advance, grid.charHeight).color, legibility);
				glyph(out, scrolled(word, first + k, shift), x, y, grid.charWidth, grid.charHeight, ink, opacity);
			}
		}
	}

	return out;
}
