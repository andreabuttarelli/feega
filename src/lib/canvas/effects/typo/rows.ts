import { cellStats, glyph, hash, rowSpans, rowStream, type CellStats, type Rgb, type TextGrid } from './core';
import { fadeOf, settleCell, wordFor } from './temporal';
import type { Motion } from './params';
import type { Pixels } from '../types';

export type Ink = { rgb: Rgb; opacity: number; block: Rgb | null };

export type RowLayout = { words: string[]; grid: TextGrid; seed: number; scroll: number; cycle: number };

const ID_STRIDE = 7919;

export function drawText(out: Pixels, text: string, x: number, y: number, grid: TextGrid, rgb: Rgb, opacity: number): void {
	for (let k = 0; k < text.length; k++) {
		glyph(out, text[k], x + k * grid.charWidth, y, grid.charWidth, grid.charHeight, rgb, opacity);
	}
}

export function renderRows(pixels: Pixels, out: Pixels, layout: RowLayout, motion: Motion, inkOf: (stats: CellStats, row: number, screenColumn: number) => Ink): void {
	const { grid, words, seed } = layout;
	const panColumns = Math.floor(motion.pan.x / grid.charWidth);
	const panRows = Math.floor(motion.pan.y / grid.charHeight);
	const offsetX = Math.round(motion.pan.x - panColumns * grid.charWidth);
	const offsetY = Math.round(motion.pan.y - panRows * grid.charHeight);

	for (let screenRow = -1; screenRow <= grid.rows; screenRow++) {
		const worldRow = screenRow - panRows;
		const stream = rowStream(words, worldRow, seed);
		const direction = worldRow % 2 === 0 ? 1 : -1;
		const scrolled = direction * Math.floor(layout.cycle * stream.length * layout.scroll);
		const shift = Math.floor(hash(worldRow, 2, seed) * stream.length) + scrolled - panColumns - 1;
		const y = screenRow * grid.charHeight + offsetY;

		for (const span of rowSpans(stream, grid.columns + 2, shift)) {
			const x = (span.start - 1) * grid.charWidth + offsetX;
			const width = span.text.length * grid.charWidth;
			if (x + width <= 0 || x >= pixels.width || y + grid.charHeight <= 0 || y >= pixels.height) {
				continue;
			}

			const left = Math.max(0, x);
			const top = Math.max(0, y);
			const stats = cellStats(pixels, left, top, Math.min(pixels.width, x + width) - left, Math.min(pixels.height, y + grid.charHeight) - top);
			const world = span.start + shift;
			const id = worldRow * ID_STRIDE + world;
			const cell = settleCell(motion.memory, `${worldRow}:${world}`, id, stats.luminance, motion.settle);
			const ink = inkOf(stats, worldRow, Math.floor(Math.max(0, x) / grid.charWidth));

			if (ink.block) {
				fillBlock(out, x - 2, y + 1, span.text.length * grid.charWidth + 4, grid.charHeight - 2, ink.block);
			}

			const fade = fadeOf(cell.changedAt, motion.settle.time, motion.settle.fade);
			const current = wordFor(words, span.text.length, id, cell.version, span.text);
			if (fade < 1) {
				drawText(out, wordFor(words, span.text.length, id, cell.previous, span.text), x, y, grid, ink.rgb, ink.opacity * (1 - fade));
			}
			drawText(out, current, x, y, grid, ink.rgb, ink.opacity * fade);
		}
	}
}

function fillBlock(out: Pixels, x0: number, y0: number, w: number, h: number, rgb: Rgb): void {
	for (let y = Math.max(0, y0); y < Math.min(out.height, y0 + h); y++) {
		for (let x = Math.max(0, x0); x < Math.min(out.width, x0 + w); x++) {
			const i = (y * out.width + x) * 4;
			out.data[i] = rgb[0];
			out.data[i + 1] = rgb[1];
			out.data[i + 2] = rgb[2];
		}
	}
}
