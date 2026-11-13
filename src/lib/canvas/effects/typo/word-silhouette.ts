import { BRAND_ORANGE, motionOf, motionParams, textParam } from './params';
import { cellStats, fill, hexRgb, luminance, numberOf, parseWords, phase, sourceAverage, textGrid, tone, type Params, type Rgb } from './core';
import { renderRows } from './rows';
import type { EffectParam, Pixels } from '../types';

const DEFAULT_TEXT = 'BUCKET POLICY TRUST GROUP ALLOW DENY ACCESS SUBNET VAULT ADMIN DEPLOY IMAGE ROLE TOKEN';
const PERCENT = 100;
const NOISE = 0.1;
const EDGE_BAND = 0.12;
const EDGE_OPACITY = 0.55;
const INSIDE_OPACITY = 0.95;
const SOURCE_DESATURATE = 0.5;
const SOURCE_DARKEN = 0.55;
const INNER_DETAIL = 0.25;
const CENTRE_SHARE = 0.25;

export function subjectIsDark(pixels: Pixels, polarity: string): boolean {
	if (polarity !== Polarity.Auto) {
		return polarity === Polarity.Dark;
	}

	const w = Math.round(pixels.width * CENTRE_SHARE);
	const h = Math.round(pixels.height * CENTRE_SHARE);
	const centre = cellStats(pixels, Math.round((pixels.width - w) / 2), Math.round((pixels.height - h) / 2), w, h).luminance;
	return centre < cellStats(pixels, 0, 0, pixels.width, pixels.height).luminance;
}

export enum BackgroundMode {
	Source = 'source',
	Set = 'set'
}

export enum MaskSource {
	Luminance = 'luminance',
	Alpha = 'alpha'
}

export enum Polarity {
	Auto = 'auto',
	Bright = 'bright',
	Dark = 'dark'
}

export const WORD_SILHOUETTE_PARAMS: EffectParam[] = [
	textParam(DEFAULT_TEXT),
	{ name: 'cellSize', label: 'Text size', kind: 'range', min: 6, max: 48, step: 1, default: 14 },
	{ name: 'threshold', label: 'Silhouette threshold', kind: 'range', min: 0, max: 100, step: 1, default: 50 },
	{ name: 'contrast', label: 'Contrast', kind: 'range', min: 0.5, max: 8, step: 0.1, default: 3 },
	{
		name: 'mask',
		label: 'Silhouette from',
		kind: 'select',
		options: [
			{ value: MaskSource.Luminance, label: 'Luminance' },
			{ value: MaskSource.Alpha, label: 'Transparency' }
		],
		default: MaskSource.Luminance
	},
	{
		name: 'polarity',
		label: 'Subject is',
		kind: 'select',
		options: [
			{ value: Polarity.Auto, label: 'Auto (centre vs edges)' },
			{ value: Polarity.Bright, label: 'Bright' },
			{ value: Polarity.Dark, label: 'Dark' }
		],
		default: Polarity.Auto
	},
	{
		name: 'backgroundMode',
		label: 'Background',
		kind: 'select',
		options: [
			{ value: BackgroundMode.Source, label: 'From the source' },
			{ value: BackgroundMode.Set, label: 'Chosen colour' }
		],
		default: BackgroundMode.Source
	},
	{ name: 'background', label: 'Background colour', kind: 'color', default: '#3e5a4f' },
	{ name: 'ink', label: 'Text colour', kind: 'color', default: '#f3f3ee' },
	{ name: 'faint', label: 'Texture opacity', kind: 'range', min: 0, max: 100, step: 1, default: 14 },
	{ name: 'accent', label: 'Inner accent colour', kind: 'color', default: BRAND_ORANGE },
	{ name: 'inner', label: 'Inner accent above', kind: 'range', min: 50, max: 101, step: 1, default: 97 },
	...motionParams(NOISE, 0)
];

export function backgroundOf(pixels: Pixels, params: Params): Rgb {
	if (params.backgroundMode === BackgroundMode.Set) {
		return hexRgb(params.background, [62, 90, 79]);
	}

	const average = sourceAverage(pixels);
	const grey = luminance(average) * 255;
	return average.map((c) => Math.round((c + (grey - c) * SOURCE_DESATURATE) * SOURCE_DARKEN)) as Rgb;
}

export function apply(pixels: Pixels, params: Params, time = 0, state?: Record<string, unknown>): Pixels {
	const background = backgroundOf(pixels, params);
	const out = fill(pixels, background);
	const words = parseWords(params.text, DEFAULT_TEXT);
	const grid = textGrid(pixels, numberOf(params, 'cellSize', 14));
	const threshold = numberOf(params, 'threshold', 50) / PERCENT;
	const contrast = numberOf(params, 'contrast', 3);
	const fromAlpha = params.mask === MaskSource.Alpha;
	const dark = subjectIsDark(pixels, String(params.polarity ?? Polarity.Auto));
	const ink = hexRgb(params.ink, [243, 243, 238]);
	const accent = hexRgb(params.accent, [255, 81, 0]);
	const faint = numberOf(params, 'faint', 14) / PERCENT;
	const inner = numberOf(params, 'inner', 97) / PERCENT;
	const cycle = phase(time, numberOf(params, 'loop', 4));
	const motion = motionOf(pixels, params, time, state, NOISE);
	const layout = { words, grid, seed: numberOf(params, 'seed', 1), scroll: Math.round(numberOf(params, 'scroll', 0)), cycle };

	renderRows(pixels, out, layout, motion, (stats) => {
		const raw = fromAlpha ? stats.alpha / 255 : tone(stats.luminance, threshold, contrast);
		const mask = dark && !fromAlpha ? 1 - raw : raw;

		if (mask < 0.5 - EDGE_BAND) {
			return { rgb: ink, opacity: faint, block: null };
		}
		if (mask < 0.5 + EDGE_BAND) {
			return { rgb: ink, opacity: faint + (EDGE_OPACITY - faint) * ((mask - 0.5 + EDGE_BAND) / (2 * EDGE_BAND)), block: null };
		}
		return { rgb: mask >= inner && stats.contrast > INNER_DETAIL ? accent : ink, opacity: INSIDE_OPACITY, block: null };
	});

	return out;
}
