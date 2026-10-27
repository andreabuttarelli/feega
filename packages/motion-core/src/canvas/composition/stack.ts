import { clampParams } from './clamp';
import { card, modulo, smoothstep, stepAt } from './loop';
import type { LayoutParam, LayoutParams, Transform } from './types';

export const params: LayoutParam[] = [
	{ name: 'visible', label: 'Cards in the pile', kind: 'range', min: 2, max: 6, step: 1, default: 4 },
	{ name: 'scale', label: 'Card size', kind: 'range', min: 1, max: 6, step: 0.05, default: 3.6 },
	{ name: 'depth', label: 'Depth between cards', kind: 'range', min: 0.1, max: 2, step: 0.05, default: 0.6 },
	{ name: 'rise', label: 'Peek above', kind: 'range', min: 0, max: 1, step: 0.02, default: 0.3 },
	{ name: 'shrink', label: 'Shrink behind', kind: 'range', min: 0, max: 0.15, step: 0.01, default: 0.05 },
	{
		name: 'direction',
		label: 'Leaves towards',
		kind: 'select',
		options: [
			{ value: 'left', label: 'Left' },
			{ value: 'right', label: 'Right' },
			{ value: 'up', label: 'Up' }
		],
		default: 'left'
	},
	{ name: 'hold', label: 'Hold', kind: 'range', min: 0, max: 0.8, step: 0.05, default: 0.45 }
];

const EXITS: Record<string, { x: number; y: number }> = {
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
	up: { x: 0, y: 1 }
};
const EXIT_DISTANCE = 1.6;

export function instances(mediaCount: number, rawParams: LayoutParams): number {
	if (mediaCount <= 0) {
		return 0;
	}

	const visible = Math.round(Number(clampParams(params, rawParams).visible));
	return Math.max(mediaCount, visible + 2);
}

export function transforms(count: number, rawParams: LayoutParams, t: number): Transform[] {
	if (count <= 0) {
		return [];
	}

	const values = clampParams(params, rawParams);
	const visible = Math.round(Number(values.visible));
	const scale = Number(values.scale);
	const depthGap = Number(values.depth);
	const rise = Number(values.rise);
	const shrink = Number(values.shrink);
	const exit = EXITS[String(values.direction)];
	const step = stepAt(t, count, Number(values.hold));

	return Array.from({ length: count }, (_, index) => {
		const depth = modulo(index - step.index, count) - step.glide;

		if (depth < 0) {
			const away = -depth;
			const travel = away * scale * EXIT_DISTANCE;
			return card({ x: exit.x * travel, y: exit.y * travel, z: 0 }, scale, 1 - smoothstep(0.35, 1, away));
		}

		const size = scale * (1 - shrink * depth);
		const opacity = 1 - smoothstep(visible - 1, visible, depth);
		return card({ x: 0, y: depth * rise, z: -depth * depthGap }, size, opacity);
	});
}
