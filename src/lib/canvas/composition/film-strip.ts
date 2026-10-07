import { clampParams } from './clamp';
import { card, centered, smoothstep, stepAt } from './loop';
import type { LayoutParam, LayoutParams, Transform } from './types';

export const params: LayoutParam[] = [
	{ name: 'items', label: 'Media count', kind: 'range', min: 3, max: 15, step: 1, default: 7 },
	{ name: 'gap', label: 'Card spacing', kind: 'range', min: 1, max: 6, step: 0.05, default: 3.1 },
	{ name: 'scale', label: 'Card size', kind: 'range', min: 0.5, max: 4, step: 0.05, default: 2.3 },
	{ name: 'focusScale', label: 'Focus zoom', kind: 'range', min: 1, max: 2, step: 0.05, default: 1.3 },
	{ name: 'dim', label: 'Dim the sides', kind: 'range', min: 0, max: 0.9, step: 0.05, default: 0.55 },
	{ name: 'hold', label: 'Hold', kind: 'range', min: 0, max: 0.8, step: 0.05, default: 0.5 }
];

const FOCUS_LIFT = 0.4;

export function instances(mediaCount: number, rawParams: LayoutParams): number {
	if (mediaCount <= 0) {
		return 0;
	}

	return Math.max(mediaCount, Math.round(Number(clampParams(params, rawParams).items)));
}

export function transforms(count: number, rawParams: LayoutParams, t: number): Transform[] {
	if (count <= 0) {
		return [];
	}

	const values = clampParams(params, rawParams);
	const gap = Number(values.gap);
	const scale = Number(values.scale);
	const focusScale = Number(values.focusScale);
	const dim = Number(values.dim);
	const step = stepAt(t, count, Number(values.hold));
	const half = count / 2;

	return Array.from({ length: count }, (_, index) => {
		const slot = centered(index - step.index - step.glide, count);
		const focus = 1 - smoothstep(0, 1, Math.abs(slot));
		const edge = 1 - smoothstep(half - 1, half - 0.5, Math.abs(slot));
		const size = scale * (1 + (focusScale - 1) * focus);
		const offset = Math.sign(slot) * (focusScale - 1) * scale * 0.5 * Math.min(1, Math.abs(slot));

		return card({ x: slot * gap + offset, y: 0, z: focus * FOCUS_LIFT }, size, (1 - dim * (1 - focus)) * edge);
	});
}
