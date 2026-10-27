import { clampParams } from './clamp';
import { DEGREES, card, centered, frameOf, smoothstep } from './loop';
import type { LayoutParam, LayoutParams, Transform } from './types';

export const params: LayoutParam[] = [
	{ name: 'rows', label: 'Rows', kind: 'range', min: 1, max: 5, step: 1, default: 3 },
	{ name: 'gap', label: 'Card spacing', kind: 'range', min: 1.2, max: 5, step: 0.1, default: 2.75 },
	{ name: 'rowGap', label: 'Row spacing', kind: 'range', min: 1.2, max: 5, step: 0.1, default: 2.75 },
	{ name: 'scale', label: 'Card size', kind: 'range', min: 0.5, max: 4, step: 0.05, default: 2.5 },
	{ name: 'speed', label: 'Laps per loop', kind: 'range', min: 1, max: 3, step: 1, default: 1 },
	{ name: 'tilt', label: 'Tilt', kind: 'range', min: -20, max: 20, step: 1, default: 0 }
];

type Row = { index: number; length: number };

function rowsOf(rawParams: LayoutParams): Row[] {
	const values = clampParams(params, rawParams);
	const gap = Number(values.gap);
	const rows = Math.round(Number(values.rows));
	const tilt = Math.abs(Number(values.tilt)) * DEGREES;
	const span = frameOf(rawParams).width / Math.cos(tilt) + rows * Number(values.rowGap) * Math.sin(tilt);
	const base = Math.max(3, Math.ceil((span + Number(values.scale)) / gap) + 1);

	return Array.from({ length: rows }, (_, index) => ({ index, length: base + (index % 2) }));
}

export function instances(mediaCount: number, rawParams: LayoutParams): number {
	if (mediaCount <= 0) {
		return 0;
	}

	return rowsOf(rawParams).reduce((sum, row) => sum + row.length, 0);
}

export function transforms(count: number, rawParams: LayoutParams, t: number): Transform[] {
	if (count <= 0) {
		return [];
	}

	const values = clampParams(params, rawParams);
	const gap = Number(values.gap);
	const rowGap = Number(values.rowGap);
	const scale = Number(values.scale);
	const laps = Math.round(Number(values.speed));
	const tilt = Number(values.tilt) * DEGREES;
	const rows = rowsOf(rawParams);
	const middle = (rows.length - 1) / 2;
	const poses: Transform[] = [];

	for (const row of rows) {
		const width = row.length * gap;
		const direction = row.index % 2 ? -1 : 1;
		const y = (middle - row.index) * rowGap;

		for (let slot = 0; slot < row.length; slot++) {
			const x = centered(slot * gap + direction * t * laps * width, width);
			const opacity = 1 - smoothstep(width / 2 - gap / 2, width / 2, Math.abs(x));
			const position = {
				x: x * Math.cos(tilt) - y * Math.sin(tilt),
				y: x * Math.sin(tilt) + y * Math.cos(tilt),
				z: 0
			};
			poses.push(card(position, scale, opacity, { x: 0, y: 0, z: tilt }));
		}
	}

	return Array.from({ length: count }, (_, index) => poses[index % poses.length]);
}
