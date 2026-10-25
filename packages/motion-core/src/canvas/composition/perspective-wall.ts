import { clampParams } from './clamp';
import { DEGREES, card } from './loop';
import type { LayoutParam, LayoutParams, Transform } from './types';

export const params: LayoutParam[] = [
	{ name: 'columns', label: 'Columns', kind: 'range', min: 3, max: 10, step: 1, default: 5 },
	{ name: 'rows', label: 'Rows', kind: 'range', min: 1, max: 5, step: 1, default: 3 },
	{ name: 'gap', label: 'Spacing', kind: 'range', min: 1.2, max: 4, step: 0.05, default: 2.7 },
	{ name: 'scale', label: 'Card size', kind: 'range', min: 0.5, max: 3.5, step: 0.05, default: 2.45 },
	{ name: 'angle', label: 'Wall angle', kind: 'range', min: 0, max: 60, step: 1, default: 34 },
	{ name: 'travel', label: 'Pan', kind: 'range', min: 0, max: 8, step: 0.1, default: 2.4 },
	{ name: 'offset', label: 'Wall offset', kind: 'range', min: -4, max: 4, step: 0.1, default: 0.6 }
];

const FULL_TURN = Math.PI * 2;

export function instances(mediaCount: number, rawParams: LayoutParams): number {
	if (mediaCount <= 0) {
		return 0;
	}

	const values = clampParams(params, rawParams);
	return Math.max(mediaCount, Math.round(Number(values.columns)) * Math.round(Number(values.rows)));
}

export function transforms(count: number, rawParams: LayoutParams, t: number): Transform[] {
	if (count <= 0) {
		return [];
	}

	const values = clampParams(params, rawParams);
	const columns = Math.round(Number(values.columns));
	const rows = Math.round(Number(values.rows));
	const gap = Number(values.gap);
	const scale = Number(values.scale);
	const angle = Number(values.angle) * DEGREES;
	const pan = Math.sin(t * FULL_TURN) * Number(values.travel);
	const offset = Number(values.offset);

	return Array.from({ length: count }, (_, index) => {
		const column = index % columns;
		const row = Math.floor(index / columns) % rows;
		const along = (column - (columns - 1) / 2) * gap - pan;
		const y = ((rows - 1) / 2 - row) * gap;

		return card(
			{ x: along * Math.cos(angle) + offset, y, z: -along * Math.sin(angle) },
			scale,
			1,
			{ x: 0, y: angle, z: 0 }
		);
	});
}
