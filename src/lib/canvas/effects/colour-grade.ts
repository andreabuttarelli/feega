import type { Pixels } from './types';

const MID_GREY = 128;
const TEMPERATURE_SHIFT = 0.5;

export function apply(pixels: Pixels, params: Record<string, number | string>): Pixels {
	const brightness = Number(params.brightness) || 0;
	const contrast = params.contrast === undefined ? 1 : Number(params.contrast);
	const warmth = (Number(params.temperature) || 0) * TEMPERATURE_SHIFT;
	const out = new Uint8ClampedArray(pixels.data.length);

	for (let i = 0; i < pixels.data.length; i += 4) {
		out[i] = grade(pixels.data[i], brightness + warmth, contrast);
		out[i + 1] = grade(pixels.data[i + 1], brightness, contrast);
		out[i + 2] = grade(pixels.data[i + 2], brightness - warmth, contrast);
		out[i + 3] = pixels.data[i + 3];
	}

	return { width: pixels.width, height: pixels.height, data: out };
}

function grade(channel: number, shift: number, contrast: number): number {
	return (channel - MID_GREY) * contrast + MID_GREY + shift;
}
