import { clampParams } from './clamp';
import { DEGREES, card, smoothstep } from './loop';
import type { LayoutParam, LayoutParams, Transform } from './types';

export const params: LayoutParam[] = [
	{ name: 'items', label: 'Media count', kind: 'range', min: 6, max: 40, step: 1, default: 16 },
	{ name: 'radius', label: 'Radius', kind: 'range', min: 1, max: 6, step: 0.05, default: 2.7 },
	{ name: 'scale', label: 'Card size', kind: 'range', min: 0.3, max: 3, step: 0.05, default: 1.25 },
	{ name: 'turns', label: 'Turns per loop', kind: 'range', min: 1, max: 3, step: 1, default: 1 },
	{ name: 'axis', label: 'Axis tilt', kind: 'range', min: -40, max: 40, step: 1, default: 14 },
	{ name: 'backOpacity', label: 'Back side', kind: 'range', min: 0, max: 0.6, step: 0.05, default: 0 }
];

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const FULL_TURN = Math.PI * 2;

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
	const radius = Number(values.radius);
	const scale = Number(values.scale);
	const spin = t * Math.round(Number(values.turns)) * FULL_TURN;
	const axis = Number(values.axis) * DEGREES;
	const back = Number(values.backOpacity);

	return Array.from({ length: count }, (_, index) => {
		const height = 1 - (2 * (index + 0.5)) / count;
		const ring = Math.sqrt(1 - height * height);
		const longitude = index * GOLDEN_ANGLE + spin;
		const sx = Math.sin(longitude) * ring;
		const sz = Math.cos(longitude) * ring;
		const normal = {
			x: sx,
			y: height * Math.cos(axis) - sz * Math.sin(axis),
			z: height * Math.sin(axis) + sz * Math.cos(axis)
		};
		const facing = smoothstep(-0.15, 0.3, normal.z);
		const rotation = { x: Math.atan2(-normal.y, normal.z), y: Math.asin(Math.max(-1, Math.min(1, normal.x))), z: 0 };

		return card(
			{ x: normal.x * radius, y: normal.y * radius, z: normal.z * radius },
			scale,
			back + (1 - back) * facing,
			rotation
		);
	});
}
