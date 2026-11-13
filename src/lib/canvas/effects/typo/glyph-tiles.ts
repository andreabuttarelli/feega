import { BRAND_ORANGE, motionOf, motionParams, textParam } from './params';
import { fadeOf, settleCell } from './temporal';
import { unit, cellStats, fill, glyph, GLYPH_ASPECT, hash, hexRgb, luminance, numberOf, parseWords, phase, quantise, rect, type Params, type Rgb } from './core';
import type { EffectParam, Pixels } from '../types';

const DEFAULT_LABELS = 'DATA, ACCESS, IDENTITY, CLOUD';
const PERCENT = 100;
const CHARSETS: Record<string, string> = {
	symbols: '#$%&()*+-/:;<=>?@[]^{|}~0123456789ABCDEF',
	hex: '0123456789ABCDEF',
	letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
};
const NOISE = 0.1;
const ID_STRIDE = 7919;
const LIGHT_TILE = 0.55;
const EMPTY_LIFT = 8;
const EMPTY_GLYPH_OPACITY = 0.18;
const GLYPH_SCALE = 0.5;
const CHIP_HEIGHT = 0.5;
const CHIP_PAD = 0.6;
const CHIP_RADIUS = 3;
const DARK_INK: Rgb = [28, 29, 31];
const LIGHT_INK: Rgb = [238, 238, 234];
const CHIP_FILL: Rgb = [17, 18, 20];

export enum AccentLine {
	Column = 'column',
	Row = 'row',
	Diagonal = 'diagonal',
	Off = 'off'
}

export const GLYPH_TILES_PARAMS: EffectParam[] = [
	{ name: 'cellSize', label: 'Tile size', kind: 'range', min: 12, max: 120, step: 1, default: 40 },
	{ name: 'gap', label: 'Gap', kind: 'range', min: 0, max: 16, step: 1, default: 4 },
	{ name: 'radius', label: 'Corner radius (%)', kind: 'range', min: 0, max: 50, step: 1, default: 14 },
	{ name: 'levels', label: 'Palette levels', kind: 'range', min: 2, max: 8, step: 1, default: 4 },
	{ name: 'threshold', label: 'Empty below', kind: 'range', min: 0, max: 100, step: 1, default: 22 },
	{ name: 'background', label: 'Background', kind: 'color', default: '#1c1d1f' },
	{ name: 'accent', label: 'Accent colour', kind: 'color', default: BRAND_ORANGE },
	{
		name: 'accentLine',
		label: 'Accent line',
		kind: 'select',
		options: [
			{ value: AccentLine.Column, label: 'Column' },
			{ value: AccentLine.Row, label: 'Row' },
			{ value: AccentLine.Diagonal, label: 'Diagonal' },
			{ value: AccentLine.Off, label: 'Off' }
		],
		default: AccentLine.Column
	},
	{
		name: 'charset',
		label: 'Glyphs',
		kind: 'select',
		options: [
			{ value: 'symbols', label: 'Symbols' },
			{ value: 'hex', label: 'Hex' },
			{ value: 'letters', label: 'Letters' }
		],
		default: 'symbols'
	},
	{ ...textParam(DEFAULT_LABELS), name: 'labels', label: 'Label chips' },
	{ name: 'labelCount', label: 'Chips', kind: 'range', min: 0, max: 12, step: 1, default: 4 },
	...motionParams(NOISE, 0).filter((param) => param.name !== 'scroll' && param.name !== 'follow')
];

type Tiles = { size: number; columns: number; rows: number };

export function accentAt(line: string, column: number, row: number, tiles: Tiles, offset: number): boolean {
	if (line === AccentLine.Column) {
		return column === offset % tiles.columns;
	}
	if (line === AccentLine.Row) {
		return row === offset % tiles.rows;
	}
	if (line === AccentLine.Diagonal) {
		return (column + row) % tiles.columns === offset % tiles.columns;
	}
	return false;
}

export function apply(pixels: Pixels, params: Params, time = 0, state?: Record<string, unknown>): Pixels {
	const background = hexRgb(params.background, [28, 29, 31]);
	const out = fill(pixels, background);
	const scale = unit(pixels);
	const size = Math.max(6, Math.round(numberOf(params, 'cellSize', 40) * scale));
	const tiles: Tiles = { size, columns: Math.ceil(pixels.width / size), rows: Math.ceil(pixels.height / size) };
	const gap = Math.min(size / 3, Math.round(numberOf(params, 'gap', 4) * scale));
	const radius = (numberOf(params, 'radius', 14) / PERCENT) * size;
	const levels = numberOf(params, 'levels', 4);
	const threshold = numberOf(params, 'threshold', 22) / PERCENT;
	const accent = hexRgb(params.accent, [255, 81, 0]);
	const line = String(params.accentLine ?? AccentLine.Column);
	const charset = CHARSETS[String(params.charset)] ?? CHARSETS.symbols;
	const seed = numberOf(params, 'seed', 1);
	const loop = numberOf(params, 'loop', 4);
	const motion = motionOf(pixels, { ...params, follow: 'off' }, time, state, NOISE);
	const offset = Math.floor(hash(seed, 5, 5) * tiles.columns * 0.4 + tiles.columns * 0.4) + Math.floor(phase(time, loop) * tiles.columns);
	const empty: Rgb = background.map((c) => Math.min(255, c + EMPTY_LIFT)) as Rgb;
	const tile = size - gap;
	const glyphHeight = Math.round(tile * GLYPH_SCALE);
	const glyphWidth = Math.round(glyphHeight * GLYPH_ASPECT);

	for (let row = 0; row < tiles.rows; row++) {
		for (let column = 0; column < tiles.columns; column++) {
			const x = Math.round(column * size + gap / 2);
			const y = Math.round(row * size + gap / 2);
			const stats = cellStats(pixels, column * size, row * size, size, size);
			const lit = stats.luminance >= threshold;
			const accented = lit && accentAt(line, column, row, tiles, offset);
			const colour = accented ? accent : lit ? quantise(stats.color, levels) : empty;
			const ink = accented || luminance(colour) > LIGHT_TILE ? DARK_INK : LIGHT_INK;
			const id = row * ID_STRIDE + column;
			const cell = settleCell(motion.memory, `${row}:${column}`, id, stats.luminance, motion.settle);
			const fade = fadeOf(cell.changedAt, time, motion.settle.fade);
			const glyphX = x + Math.round((tile - glyphWidth) / 2);
			const glyphY = y + Math.round((tile - glyphHeight) / 2);
			const strength = lit ? 1 : EMPTY_GLYPH_OPACITY;

			rect(out, x, y, tile, tile, colour, radius);
			if (fade < 1) {
				glyph(out, glyphOf(charset, id, cell.previous, seed), glyphX, glyphY, glyphWidth, glyphHeight, ink, strength * (1 - fade));
			}
			glyph(out, glyphOf(charset, id, cell.version, seed), glyphX, glyphY, glyphWidth, glyphHeight, ink, strength * fade);
		}
	}

	drawChips(out, parseWords(params.labels, DEFAULT_LABELS), numberOf(params, 'labelCount', 4), tiles, seed);
	return out;
}

function glyphOf(charset: string, id: number, version: number, seed: number): string {
	return charset[Math.floor(hash(id, version, seed) * charset.length)];
}

function drawChips(out: Pixels, labels: string[], count: number, tiles: Tiles, seed: number): void {
	const height = Math.round(tiles.size * CHIP_HEIGHT);
	const charHeight = Math.round(height * 0.62);
	const charWidth = Math.max(3, Math.round(charHeight * GLYPH_ASPECT));

	for (let k = 0; k < count; k++) {
		const label = labels[k % labels.length].toUpperCase();
		const width = Math.round(label.length * charWidth + height * CHIP_PAD * 2);
		const row = Math.floor(hash(k, 1, seed + 13) * tiles.rows);
		const column = Math.floor(hash(k, 2, seed + 13) * Math.max(1, tiles.columns - Math.ceil(width / tiles.size)));
		const x = column * tiles.size;
		const y = row * tiles.size + Math.round((tiles.size - height) / 2);

		rect(out, x, y, width, height, CHIP_FILL, CHIP_RADIUS);
		for (let c = 0; c < label.length; c++) {
			glyph(out, label[c], Math.round(x + height * CHIP_PAD + c * charWidth), y + Math.round((height - charHeight) / 2), charWidth, charHeight, LIGHT_INK, 1);
		}
	}
}
