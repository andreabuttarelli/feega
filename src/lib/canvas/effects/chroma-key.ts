import type { Pixels } from './types';

export function apply(pixels: Pixels, params: Record<string, number | string>): Pixels {
	const key = hexToRgb(String(params.color ?? '#00ff00'));
	const tolerance = Number(params.tolerance) || 0;
	const out = new Uint8ClampedArray(pixels.data);

	for (let i = 0; i < out.length; i += 4) {
		const distance = Math.hypot(out[i] - key[0], out[i + 1] - key[1], out[i + 2] - key[2]);
		if (distance <= tolerance) {
			out[i + 3] = 0;
		}
	}

	return { width: pixels.width, height: pixels.height, data: out };
}

function hexToRgb(hex: string): [number, number, number] {
	const normalized = hex.replace('#', '');
	return [
		parseInt(normalized.slice(0, 2), 16),
		parseInt(normalized.slice(2, 4), 16),
		parseInt(normalized.slice(4, 6), 16)
	];
}
