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

export type Step = { index: number; glide: number };

export function stepAt(t: number, steps: number, hold: number): Step {
	const position = modulo(t, 1) * steps;
	const index = Math.floor(position);
	const within = position - index;
	const glide = within <= hold ? 0 : easeInOutExpo((within - hold) / (1 - hold));
	return { index, glide };
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
