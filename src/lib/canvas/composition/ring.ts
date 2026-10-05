import { clampParams } from './clamp';
import type { LayoutParam, LayoutParams, Transform } from './types';

export enum Spin {
	Left = 'left',
	Right = 'right'
}

export enum RingSection {
	Shape = 'shape',
	Motion = 'motion',
	Look = 'look',
	Camera = 'camera'
}

export type RingNumber = { label: string; min: number; max: number; step: number; fallback: number; section: RingSection };

const n = (label: string, min: number, max: number, step: number, fallback: number, section: RingSection): RingNumber => ({ label, min, max, step, fallback, section });

export const RING_NUMBERS = {
	ringRadius: n('Radius', 0.1, 2, 0.01, 0.6, RingSection.Shape),
	cardHeight: n('Card height', 0.05, 1.5, 0.01, 0.34, RingSection.Shape),
	gap: n('Gap', 0, 0.2, 0.001, 0.025, RingSection.Shape),
	tiltX: n('Tilt X', -90, 90, 1, -14, RingSection.Shape),
	tiltZ: n('Tilt Z', -90, 90, 1, -12, RingSection.Shape),
	spin: n('Spin offset', -360, 360, 1, 0, RingSection.Motion),
	backOpacity: n('Back opacity', 0, 1, 0.01, 0.55, RingSection.Look),
	backBlur: n('Back blur', 0, 40, 0.5, 1.5, RingSection.Look),
	shadowOpacity: n('Shadow', 0, 1, 0.01, 0.3, RingSection.Look),
	cornerRadius: n('Corner radius', 0, 200, 1, 0, RingSection.Look),
	cameraDistance: n('Perspective', 200, 6000, 10, 1500, RingSection.Camera),
	cameraHeight: n('Camera height', -1, 1, 0.01, 0.1, RingSection.Camera)
} as const satisfies Record<string, RingNumber>;

export type RingNumberKey = keyof typeof RING_NUMBERS;
export const RING_NUMBER_KEYS = Object.keys(RING_NUMBERS) as RingNumberKey[];

export const RING_COUNT = { min: 2, max: 24, fallback: 8 } as const;
export const RING_TURNS = { min: 0, max: 8, fallback: 1 } as const;

export const params: LayoutParam[] = [
	{ name: 'count', label: 'Cards', kind: 'range', min: RING_COUNT.min, max: RING_COUNT.max, step: 1, default: RING_COUNT.fallback },
	{ name: 'turns', label: 'Turns per loop', kind: 'range', min: RING_TURNS.min, max: RING_TURNS.max, step: 1, default: RING_TURNS.fallback },
	{ name: 'cardColor', label: 'Card colour', kind: 'color', default: '#ffffff' },
	{ name: 'direction', label: 'Direction', kind: 'select', options: [{ value: Spin.Left, label: 'Left' }, { value: Spin.Right, label: 'Right' }], default: Spin.Left },
	...RING_NUMBER_KEYS.map((name): LayoutParam => {
		const { label, min, max, step, fallback } = RING_NUMBERS[name];
		return { name, label, kind: 'range', min, max, step, default: fallback };
	})
];

export const SPIN_SIGN: Record<Spin, 1 | -1> = { [Spin.Left]: 1, [Spin.Right]: -1 };

const WORLD_PER_SHORT_SIDE = 7.6;
const REFERENCE_SHORT_SIDE_PX = 1080;
const DEGREE = Math.PI / 180;
const MAX_GAP_SHARE = 0.9;

type Matrix = [number, number, number, number, number, number, number, number, number];

const multiply = (a: Matrix, b: Matrix): Matrix => [
	a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
	a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
	a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
];
const rotX = (a: number): Matrix => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const rotY = (a: number): Matrix => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const rotZ = (a: number): Matrix => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];

function eulerXYZ(m: Matrix) {
	const y = Math.asin(Math.min(1, Math.max(-1, m[2])));
	return { x: Math.atan2(-m[5], m[8]), y, z: Math.atan2(-m[1], m[0]) };
}

export function transforms(count: number, raw: LayoutParams, t: number): Transform[] {
	const v = clampParams(params, raw);
	const num = (key: string) => Number(v[key]);
	const radius = num('ringRadius') * WORLD_PER_SHORT_SIDE;
	const height = num('cardHeight') * WORLD_PER_SHORT_SIDE;
	const angle = SPIN_SIGN[v.direction as Spin] * Math.PI * 2 * Math.round(num('turns')) * t + num('spin') * DEGREE;
	const pitch = (Math.PI * 2) / Math.max(1, count);
	const arc = pitch - Math.min(num('gap') * WORLD_PER_SHORT_SIDE / radius, pitch * MAX_GAP_SHARE);
	const tilt = multiply(rotZ(num('tiltZ') * DEGREE), rotX(num('tiltX') * DEGREE));

	return Array.from({ length: count }, (_, i) => {
		const phi = (i / count) * Math.PI * 2 + angle;
		const m = multiply(tilt, rotY(phi));
		const facing = m[8];
		return {
			position: { x: m[2] * radius, y: m[5] * radius, z: m[8] * radius },
			rotation: eulerXYZ(m),
			scale: { x: height, y: height, z: height },
			opacity: facing >= 0 ? 1 : num('backOpacity'),
			bend: radius,
			corner: num('cornerRadius') / REFERENCE_SHORT_SIDE_PX / num('cardHeight'),
			width: arc * radius
		};
	});
}
