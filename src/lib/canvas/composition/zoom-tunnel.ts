import { clampParams } from './clamp';
import { DEGREES, card, modulo, smoothstep } from './loop';
import type { LayoutParam, LayoutParams, Transform } from './types';

export const params: LayoutParam[] = [
	{ name: 'items', label: 'Media count', kind: 'range', min: 4, max: 16, step: 1, default: 8 },
	{ name: 'spacing', label: 'Depth between cards', kind: 'range', min: 2, max: 12, step: 0.5, default: 5 },
	{ name: 'radius', label: 'Spiral radius', kind: 'range', min: 0, max: 3, step: 0.05, default: 0.8 },
	{ name: 'twist', label: 'Spiral turn per card', kind: 'range', min: 0, max: 180, step: 1, default: 137 },
	{ name: 'scale', label: 'Card size', kind: 'range', min: 0.5, max: 4, step: 0.05, default: 2.4 },
	{ name: 'near', label: 'Closest depth', kind: 'range', min: 2, max: 10, step: 0.5, default: 6 },
	{ name: 'speed', label: 'Laps per loop', kind: 'range', min: 1, max: 3, step: 1, default: 1 }
];

const FAR_FADE = 0.35;

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
	const spacing = Number(values.spacing);
	const radius = Number(values.radius);
	const twist = Number(values.twist) * DEGREES;
	const scale = Number(values.scale);
	const near = Number(values.near);
	const laps = Math.round(Number(values.speed));
	const length = count * spacing;

	return Array.from({ length: count }, (_, index) => {
		const travelled = modulo(index * spacing + t * laps * length, length);
		const z = near - length + travelled;
		const arrive = smoothstep(0, length * FAR_FADE, travelled);
		const leave = 1 - smoothstep(length - spacing, length - spacing * 0.15, travelled);
		const angle = index * twist;

		return card({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z }, scale, arrive * leave);
	});
}
