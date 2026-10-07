import { clampParams } from './clamp';
import { card, centered, frameOf, smoothstep } from './loop';
import type { LayoutParam, LayoutParams, Transform } from './types';

export const params: LayoutParam[] = [
	{ name: 'columns', label: 'Columns', kind: 'range', min: 2, max: 5, step: 1, default: 2 },
	{ name: 'fill', label: 'Frame fill', kind: 'range', min: 0.4, max: 1, step: 0.02, default: 0.92 },
	{ name: 'gap', label: 'Gap', kind: 'range', min: 0, max: 1, step: 0.02, default: 0.18 },
	{ name: 'contrast', label: 'Column contrast', kind: 'range', min: 0, max: 0.5, step: 0.02, default: 0.3 },
	{ name: 'speed', label: 'Laps per loop', kind: 'range', min: 1, max: 3, step: 1, default: 1 },
	{
		name: 'direction',
		label: 'Scroll',
		kind: 'select',
		options: [
			{ value: 'up', label: 'Up' },
			{ value: 'down', label: 'Down' },
			{ value: 'alternate', label: 'Alternate' }
		],
		default: 'up'
	}
];

const DIRECTIONS: Record<string, (column: number) => number> = {
	up: () => 1,
	down: () => -1,
	alternate: (column) => (column % 2 ? -1 : 1)
};

const PORTRAIT_ASPECT = 9 / 16;

type Column = { index: number; size: number; x: number; length: number };

function columnsOf(rawParams: LayoutParams): Column[] {
	const values = clampParams(params, rawParams);
	const frame = frameOf(rawParams);
	const portraitColumns = Math.round(Number(values.columns));
	const count = Math.max(portraitColumns, Math.round((portraitColumns * frame.width) / frame.height / PORTRAIT_ASPECT));
	const gap = Number(values.gap);
	const contrast = Number(values.contrast);
	const weights = Array.from({ length: count }, (_, index) => 1 + (index % 2 ? -contrast : contrast));
	const total = weights.reduce((sum, weight) => sum + weight, 0);
	const usable = frame.width * Number(values.fill) - gap * (count - 1);
	let left = -(usable + gap * (count - 1)) / 2;

	return weights.map((weight, index) => {
		const size = (usable * weight) / total;
		const column = { index, size, x: left + size / 2, length: Math.ceil((frame.height + size) / (size + gap)) + 1 };
		left += size + gap;
		return column;
	});
}

export function instances(mediaCount: number, rawParams: LayoutParams): number {
	if (mediaCount <= 0) {
		return 0;
	}

	return columnsOf(rawParams).reduce((sum, column) => sum + column.length, 0);
}

export function transforms(count: number, rawParams: LayoutParams, t: number): Transform[] {
	if (count <= 0) {
		return [];
	}

	const values = clampParams(params, rawParams);
	const gap = Number(values.gap);
	const laps = Math.round(Number(values.speed));
	const direction = DIRECTIONS[String(values.direction)];
	const poses: Transform[] = [];

	for (const column of columnsOf(rawParams)) {
		const pitch = column.size + gap;
		const height = column.length * pitch;
		const stagger = (column.index % 2) * pitch * 0.5;

		for (let slot = 0; slot < column.length; slot++) {
			const y = centered(slot * pitch + stagger + direction(column.index) * t * laps * height, height);
			const opacity = 1 - smoothstep(height / 2 - pitch / 2, height / 2, Math.abs(y));
			poses.push(card({ x: column.x, y, z: 0 }, column.size, opacity));
		}
	}

	return Array.from({ length: count }, (_, index) => poses[index % poses.length]);
}
