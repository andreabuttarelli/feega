import { mulberry32 } from './seeded-random';
import {
	blank,
	contains,
	hexToRgba,
	kindsOf,
	makeShape,
	meanColor,
	paint,
	pickKind,
	rgbaToHex,
	shapeSvg,
	type Rgba,
	type Shape
} from './shapes';
import type { Pixels } from './types';

type Params = Record<string, number | string>;

type Cell = { x: number; y: number; w: number; h: number };

export type MosaicTile = { shape: Shape; color: Rgba };

export type MosaicLayout = { width: number; height: number; background: Rgba | null; tiles: MosaicTile[] };

export enum MosaicBackground {
	Average = 'average',
	Color = 'color',
	Transparent = 'transparent'
}

export const MOSAIC_BACKGROUND_OPTIONS = [
	{ value: MosaicBackground.Average, label: 'Colore medio' },
	{ value: MosaicBackground.Color, label: 'Colore scelto' },
	{ value: MosaicBackground.Transparent, label: 'Trasparente' }
];

const MAX_STD_DEV = 80;
const MAX_JITTER_SHRINK = 0.5;
const PERCENT = 100;
const WHITE: Rgba = [255, 255, 255, 255];

export function layoutMosaic(pixels: Pixels, params: Params): MosaicLayout {
	const minSize = Math.max(2, Math.round(Number(params.minSize) || 12));
	const maxSize = Math.max(minSize, Math.round(Number(params.maxSize) || 64));
	const threshold = ((PERCENT - (Number(params.detail) || 0)) / PERCENT) * MAX_STD_DEV;
	const gap = Math.max(0, Number(params.gap) || 0);
	const roundness = (Number(params.radius) || 0) / PERCENT;
	const jitter = (Number(params.jitter) || 0) / PERCENT;
	const kinds = kindsOf(params.shapes);
	const random = mulberry32(Math.round(Number(params.seed) || 0));
	const tiles: MosaicTile[] = [];

	for (const cell of adaptiveCells(pixels, maxSize, minSize, threshold)) {
		const kind = pickKind(kinds, random);
		const shrink = 1 - jitter * MAX_JITTER_SHRINK * random();
		const roomW = Math.max(1, cell.w - gap);
		const roomH = Math.max(1, cell.h - gap);
		const w = roomW * shrink;
		const h = roomH * shrink;
		const x = cell.x + gap / 2 + (roomW - w) * random();
		const y = cell.y + gap / 2 + (roomH - h) * random();
		const shape = makeShape(kind, x, y, w, h, roundness);
		tiles.push({ shape, color: meanColor(pixels, shape) });
	}

	return { width: pixels.width, height: pixels.height, background: backgroundOf(pixels, params), tiles };
}

export function apply(pixels: Pixels, params: Params): Pixels {
	const layout = layoutMosaic(pixels, params);
	const out = blank(layout.width, layout.height, layout.background);

	for (const { shape, color } of layout.tiles) {
		paint(out, (px, py) => contains(shape, px, py), shape, color);
	}

	return out;
}

export function mosaicSvg(pixels: Pixels, params: Params): string {
	const layout = layoutMosaic(pixels, params);
	const backdrop = layout.background
		? `<rect width="${layout.width}" height="${layout.height}" fill="${rgbaToHex(layout.background)}"/>`
		: '';
	const shapes = layout.tiles.map(({ shape, color }) => shapeSvg(shape, `fill="${rgbaToHex(color)}"${opacityOf(color)}`));

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">`,
		backdrop,
		...shapes,
		'</svg>'
	].join('');
}

function opacityOf(color: Rgba): string {
	return color[3] < 255 ? ` fill-opacity="${(color[3] / 255).toFixed(3)}"` : '';
}

function backgroundOf(pixels: Pixels, params: Params): Rgba | null {
	const mode = params.background as MosaicBackground;
	if (mode === MosaicBackground.Transparent) {
		return null;
	}
	if (mode === MosaicBackground.Color) {
		return hexToRgba(params.backgroundColor, WHITE);
	}

	const [r, g, b] = meanColor(pixels, { x: 0, y: 0, w: pixels.width, h: pixels.height });
	return [r, g, b, 255];
}

function adaptiveCells(pixels: Pixels, maxSize: number, minSize: number, threshold: number): Cell[] {
	const cells: Cell[] = [];
	const pending: Cell[] = [];

	for (let y = 0; y < pixels.height; y += maxSize) {
		for (let x = 0; x < pixels.width; x += maxSize) {
			pending.push({ x, y, w: Math.min(maxSize, pixels.width - x), h: Math.min(maxSize, pixels.height - y) });
		}
	}

	while (pending.length) {
		const cell = pending.shift()!;
		const splittable = Math.max(cell.w, cell.h) / 2 >= minSize;

		if (!splittable || luminanceStdDev(pixels, cell) <= threshold) {
			cells.push(cell);
			continue;
		}

		pending.push(...quarters(cell));
	}

	return cells.sort((a, b) => a.y - b.y || a.x - b.x);
}

function quarters(cell: Cell): Cell[] {
	const halfW = Math.ceil(cell.w / 2);
	const halfH = Math.ceil(cell.h / 2);
	const parts: Cell[] = [
		{ x: cell.x, y: cell.y, w: halfW, h: halfH },
		{ x: cell.x + halfW, y: cell.y, w: cell.w - halfW, h: halfH },
		{ x: cell.x, y: cell.y + halfH, w: halfW, h: cell.h - halfH },
		{ x: cell.x + halfW, y: cell.y + halfH, w: cell.w - halfW, h: cell.h - halfH }
	];
	return parts.filter((part) => part.w > 0 && part.h > 0);
}

function luminanceStdDev(pixels: Pixels, cell: Cell): number {
	let sum = 0;
	let squares = 0;
	const count = cell.w * cell.h;

	for (let y = cell.y; y < cell.y + cell.h; y++) {
		for (let x = cell.x; x < cell.x + cell.w; x++) {
			const i = (y * pixels.width + x) * 4;
			const luminance = 0.299 * pixels.data[i] + 0.587 * pixels.data[i + 1] + 0.114 * pixels.data[i + 2];
			sum += luminance;
			squares += luminance * luminance;
		}
	}

	const mean = sum / count;
	return Math.sqrt(Math.max(0, squares / count - mean * mean));
}
