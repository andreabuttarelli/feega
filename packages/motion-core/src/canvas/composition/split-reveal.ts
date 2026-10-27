import { clampParams } from './clamp';
import { card, frameOf, modulo, smoothstep, stepAt } from './loop';
import type { LayoutParam, LayoutParams, Transform } from './types';

export const params: LayoutParam[] = [
	{ name: 'panels', label: 'Panels', kind: 'range', min: 2, max: 4, step: 1, default: 2 },
	{ name: 'fill', label: 'Frame fill', kind: 'range', min: 0.4, max: 1, step: 0.02, default: 0.9 },
	{ name: 'gap', label: 'Gap', kind: 'range', min: 0, max: 0.3, step: 0.01, default: 0.05 },
	{ name: 'push', label: 'Push-in of the next set', kind: 'range', min: 0, max: 0.15, step: 0.01, default: 0.05 },
	{ name: 'hold', label: 'Hold', kind: 'range', min: 0, max: 0.8, step: 0.05, default: 0.5 }
];

const MAX_HEIGHT_SHARE = 0.8;
const BEHIND = 0.05;
const MIN_SETS = 3;
const CLEAR_AT = 0.8;

function setsOf(mediaCount: number, panels: number): number {
	return Math.max(MIN_SETS, Math.ceil(mediaCount / panels));
}

export function instances(mediaCount: number, rawParams: LayoutParams): number {
	if (mediaCount <= 0) {
		return 0;
	}

	const panels = Math.round(Number(clampParams(params, rawParams).panels));
	return panels * setsOf(mediaCount, panels);
}

export function transforms(count: number, rawParams: LayoutParams, t: number): Transform[] {
	if (count <= 0) {
		return [];
	}

	const values = clampParams(params, rawParams);
	const panels = Math.round(Number(values.panels));
	const gap = Number(values.gap);
	const push = Number(values.push);
	const frame = frameOf(rawParams);
	const sets = Math.max(MIN_SETS, Math.floor(count / panels));
	const size = Math.min((frame.width * Number(values.fill)) / (panels + gap * (panels - 1)), frame.height * MAX_HEIGHT_SHARE);
	const travel = (frame.height / 2 + size / 2) / CLEAR_AT;
	const step = stepAt(t, sets, Number(values.hold));

	return Array.from({ length: count }, (_, index) => {
		const set = Math.floor(index / panels) % sets;
		const panel = index % panels;
		const x = (panel - (panels - 1) / 2) * size * (1 + gap);
		const order = modulo(set - step.index, sets) - step.glide;

		if (order < 0) {
			const direction = panel % 2 ? -1 : 1;
			return card({ x, y: -order * direction * travel, z: 0 }, size, 1 - smoothstep(CLEAR_AT, 1, -order));
		}

		const waiting = Math.min(1, order);
		return card({ x, y: 0, z: -BEHIND * order }, size * (1 - push * waiting), order <= 1 ? 1 : 0);
	});
}
