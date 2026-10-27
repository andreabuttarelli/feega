import { clampParams } from './clamp';
import { DEGREES, card, hashed, modulo, smoothstep, stepAt } from './loop';
import type { LayoutParam, LayoutParams, Transform } from './types';

export const params: LayoutParam[] = [
	{ name: 'pile', label: 'Cards kept on the pile', kind: 'range', min: 1, max: 6, step: 1, default: 4 },
	{ name: 'scale', label: 'Card size', kind: 'range', min: 1, max: 5, step: 0.05, default: 3.2 },
	{ name: 'scatter', label: 'Scatter', kind: 'range', min: 0, max: 2, step: 0.05, default: 0.55 },
	{ name: 'tilt', label: 'Tilt', kind: 'range', min: 0, max: 15, step: 0.5, default: 6 },
	{ name: 'drop', label: 'Settle distance', kind: 'range', min: 0, max: 2, step: 0.05, default: 0.5 },
	{ name: 'hold', label: 'Hold', kind: 'range', min: 0, max: 0.8, step: 0.05, default: 0.4 },
	{ name: 'seed', label: 'Arrangement', kind: 'seed', default: 11 }
];

const LAYER = 0.04;
const SETTLE_SCALE = 0.06;

export function instances(mediaCount: number, rawParams: LayoutParams): number {
	if (mediaCount <= 0) {
		return 0;
	}

	return Math.max(mediaCount, Math.round(Number(clampParams(params, rawParams).pile)) + 2);
}

export function transforms(count: number, rawParams: LayoutParams, t: number): Transform[] {
	if (count <= 0) {
		return [];
	}

	const values = clampParams(params, rawParams);
	const pile = Math.round(Number(values.pile));
	const scale = Number(values.scale);
	const scatter = Number(values.scatter);
	const tilt = Number(values.tilt) * DEGREES;
	const drop = Number(values.drop);
	const seed = Number(values.seed);
	const step = stepAt(t, count, Number(values.hold));

	return Array.from({ length: count }, (_, index) => {
		const age = modulo(step.index - index, count) + step.glide;
		const arriving = 1 - Math.min(1, age);
		const opacity = smoothstep(0, 0.6, age) * (1 - smoothstep(pile, pile + 1, age));
		const position = {
			x: (hashed(seed, index, 1) - 0.5) * 2 * scatter,
			y: (hashed(seed, index, 2) - 0.5) * 2 * scatter + arriving * drop,
			z: -age * LAYER
		};
		const rotation = { x: 0, y: 0, z: (hashed(seed, index, 3) - 0.5) * 2 * tilt };

		return card(position, scale * (1 + SETTLE_SCALE * arriving), opacity, rotation);
	});
}
