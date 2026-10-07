import type { CameraState } from './camera';
import { easeInOutExpo } from './motion';
import type { LayoutParams, Transform, Vec3 } from './types';

export type Frame = { width: number; height: number };

export const DEGREES = Math.PI / 180;

const FRAME_WIDTH = '__frameWidth';
const FRAME_HEIGHT = '__frameHeight';
const PORTRAIT_FRAME: Frame = { width: 6.3, height: 11.2 };
const NO_ROTATION: Vec3 = { x: 0, y: 0, z: 0 };

export function modulo(value: number, divisor: number): number {
	return ((value % divisor) + divisor) % divisor;
}

export function centered(value: number, size: number): number {
	return modulo(value + size / 2, size) - size / 2;
}

export function smoothstep(from: number, to: number, value: number): number {
	const x = Math.min(1, Math.max(0, (value - from) / (to - from)));
	return x * x * (3 - 2 * x);
}

export type Step = { index: number; glide: number; within: number };

export type Bezier = readonly [number, number, number, number];

const BEZIER_STEPS = 40;

function cubic(a: number, b: number, t: number): number {
	const u = 1 - t;
	return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

export function bezierAt(curve: Bezier, x: number): number {
	if (x <= 0 || x >= 1) {
		return x <= 0 ? 0 : 1;
	}

	let low = 0;
	let high = 1;
	for (let i = 0; i < BEZIER_STEPS; i++) {
		const mid = (low + high) / 2;
		if (cubic(curve[0], curve[2], mid) < x) {
			low = mid;
		} else {
			high = mid;
		}
	}
	return cubic(curve[1], curve[3], (low + high) / 2);
}

export function stepAt(t: number, steps: number, hold: number, ease: (x: number) => number = easeInOutExpo): Step {
	const position = modulo(t, 1) * steps;
	const index = Math.floor(position);
	const within = position - index;
	const glide = within <= hold ? 0 : ease((within - hold) / (1 - hold));
	return { index, glide, within };
}

export function hashed(seed: number, index: number, salt: number): number {
	const value = Math.sin(seed * 12.9898 + index * 78.233 + salt * 37.719) * 43758.5453;
	return value - Math.floor(value);
}

export function withFrame(params: LayoutParams, camera: CameraState, aspect: number): LayoutParams {
	const distance = Math.hypot(
		camera.position.x - camera.target.x,
		camera.position.y - camera.target.y,
		camera.position.z - camera.target.z
	);
	const height = 2 * distance * Math.tan((camera.fov * Math.PI) / 360);
	return { ...params, [FRAME_WIDTH]: height * Math.max(0.01, aspect), [FRAME_HEIGHT]: height };
}

export function frameOf(params: LayoutParams): Frame {
	const width = Number(params[FRAME_WIDTH]);
	const height = Number(params[FRAME_HEIGHT]);
	return {
		width: Number.isFinite(width) && width > 0 ? width : PORTRAIT_FRAME.width,
		height: Number.isFinite(height) && height > 0 ? height : PORTRAIT_FRAME.height
	};
}

export function card(position: Vec3, size: number, opacity: number, rotation: Vec3 = NO_ROTATION): Transform {
	return { position, rotation, scale: { x: size, y: size, z: size }, opacity };
}
