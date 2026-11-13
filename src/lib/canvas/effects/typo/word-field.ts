import { BRAND_ORANGE, motionOf, motionParams, textParam } from './params';
import { fill, hash, hexRgb, numberOf, parseWords, phase, textGrid, tone, type Params } from './core';
import { renderRows } from './rows';
import type { EffectParam, Pixels } from '../types';

const DEFAULT_TEXT = 'TOKEN WRITE SCOPE CLUSTER REPO WEBHOOK BRANCH KEY DRIFT ROLE PROD OAUTH VAULT DEPLOY LOGS EVENT POD SECRET';
const PERCENT = 100;
const NOISE = 0.1;
const HIGHLIGHT_TONE = 0.9;
const HIGHLIGHT_SHARE = 0.35;
const SUBJECT_TONE = 0.55;
const ACCENT_ROWS = 0.3;

export enum AccentMode {
	Column = 'column',
	Highlights = 'highlights',
	Off = 'off'
}

export enum LetterCase {
	Upper = 'upper',
	AsTyped = 'as-typed'
}

export const WORD_FIELD_PARAMS: EffectParam[] = [
	textParam(DEFAULT_TEXT),
	{ name: 'cellSize', label: 'Text size', kind: 'range', min: 6, max: 48, step: 1, default: 14 },
	{ name: 'threshold', label: 'Luminance threshold', kind: 'range', min: 0, max: 100, step: 1, default: 45 },
	{ name: 'contrast', label: 'Contrast', kind: 'range', min: 0.5, max: 6, step: 0.1, default: 3 },
	{ name: 'floor', label: 'Ghost words', kind: 'range', min: 0, max: 100, step: 1, default: 12 },
	{ name: 'background', label: 'Background', kind: 'color', default: '#15171a' },
	{ name: 'ink', label: 'Text colour', kind: 'color', default: '#e4e7e1' },
	{ name: 'accent', label: 'Accent colour', kind: 'color', default: BRAND_ORANGE },
	{
		name: 'accentMode',
		label: 'Accent blocks',
		kind: 'select',
		options: [
			{ value: AccentMode.Column, label: 'Drifting column' },
			{ value: AccentMode.Highlights, label: 'Brightest words' },
			{ value: AccentMode.Off, label: 'Off' }
		],
		default: AccentMode.Column
	},
	{ name: 'accentWidth', label: 'Accent width (columns)', kind: 'range', min: 1, max: 30, step: 1, default: 8 },
	{
		name: 'case',
		label: 'Case',
		kind: 'select',
		options: [
			{ value: LetterCase.Upper, label: 'Upper' },
			{ value: LetterCase.AsTyped, label: 'As typed' }
		],
		default: LetterCase.Upper
	},
	...motionParams(NOISE, 0)
];

export function apply(pixels: Pixels, params: Params, time = 0, state?: Record<string, unknown>): Pixels {
	const background = hexRgb(params.background, [21, 23, 26]);
	const out = fill(pixels, background);
	const upper = params.case !== LetterCase.AsTyped;
	const words = parseWords(params.text, DEFAULT_TEXT).map((word) => (upper ? word.toUpperCase() : word));
	const grid = textGrid(pixels, numberOf(params, 'cellSize', 14));
	const threshold = numberOf(params, 'threshold', 45) / PERCENT;
	const contrast = numberOf(params, 'contrast', 3);
	const floor = numberOf(params, 'floor', 12) / PERCENT;
	const ink = hexRgb(params.ink, [228, 231, 225]);
	const accent = hexRgb(params.accent, [255, 81, 0]);
	const mode = String(params.accentMode ?? AccentMode.Column);
	const band = numberOf(params, 'accentWidth', 8);
	const seed = numberOf(params, 'seed', 1);
	const cycle = phase(time, numberOf(params, 'loop', 4));
	const motion = motionOf(pixels, params, time, state, NOISE);
	const bandStart = Math.floor((hash(seed, 9, 9) * 0.5 + 0.25 + cycle) * grid.columns) % grid.columns;
	const layout = { words, grid, seed, scroll: Math.round(numberOf(params, 'scroll', 0)), cycle };

	renderRows(pixels, out, layout, motion, (stats, row, column) => {
		const brightness = tone(stats.luminance, threshold, contrast);
		const accented = isAccented(mode, column, brightness, bandStart, band, row, seed) && (mode !== AccentMode.Column || inWindow(row, grid.rows, cycle, seed));
		return accented ? { rgb: background, opacity: 1, block: accent } : { rgb: ink, opacity: floor + (1 - floor) * brightness, block: null };
	});

	return out;
}

function isAccented(mode: string, column: number, brightness: number, bandStart: number, band: number, row: number, seed: number): boolean {
	if (mode === AccentMode.Column) {
		const inBand = column >= bandStart && column < bandStart + band;
		return inBand && brightness > SUBJECT_TONE;
	}

	if (mode === AccentMode.Highlights) {
		return brightness > HIGHLIGHT_TONE && hash(row, column, seed + 11) < HIGHLIGHT_SHARE;
	}

	return false;
}

function inWindow(row: number, rows: number, cycle: number, seed: number): boolean {
	const start = (hash(seed, 8, 8) * 0.4 + 0.3 + cycle) % 1;
	const at = (row / rows - start + 1) % 1;
	return at < ACCENT_ROWS;
}
