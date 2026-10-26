import type { Pixels } from './types';

export enum FitMode {
	Pad = 'pad',
	Crop = 'crop'
}

export const RATIO_OPTIONS = ['1:1', '4:5', '3:4', '16:9', '9:16'].map((value) => ({ value, label: value }));

export const FIT_MODE_OPTIONS = [
	{ value: FitMode.Pad, label: 'Pad' },
	{ value: FitMode.Crop, label: 'Crop' }
];

export function apply(pixels: Pixels, params: Record<string, number | string>): Pixels {
	const target = ratioOf(String(params.ratio ?? '1:1'));
	const mode = params.mode === FitMode.Crop ? FitMode.Crop : FitMode.Pad;
	const background = hexToRgb(String(params.background ?? '#000000'));
	const current = pixels.width / pixels.height;

	if (Math.abs(current - target) < 1e-6) {
		return pixels;
	}

	const widens = (target > current) === (mode === FitMode.Pad);
	const width = widens ? Math.round(pixels.height * target) : pixels.width;
	const height = widens ? pixels.height : Math.round(pixels.width / target);

	return mode === FitMode.Pad ? pad(pixels, width, height, background) : crop(pixels, width, height);
}

function pad(pixels: Pixels, width: number, height: number, background: [number, number, number]): Pixels {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let i = 0; i < data.length; i += 4) {
		data.set([background[0], background[1], background[2], 255], i);
	}

	const left = Math.floor((width - pixels.width) / 2);
	const top = Math.floor((height - pixels.height) / 2);
	for (let y = 0; y < pixels.height; y++) {
		const row = pixels.data.subarray(y * pixels.width * 4, (y + 1) * pixels.width * 4);
		data.set(row, ((y + top) * width + left) * 4);
	}

	return { width, height, data };
}

function crop(pixels: Pixels, width: number, height: number): Pixels {
	const data = new Uint8ClampedArray(width * height * 4);
	const left = Math.floor((pixels.width - width) / 2);
	const top = Math.floor((pixels.height - height) / 2);
	for (let y = 0; y < height; y++) {
		const start = ((y + top) * pixels.width + left) * 4;
		data.set(pixels.data.subarray(start, start + width * 4), y * width * 4);
	}

	return { width, height, data };
}

function ratioOf(ratio: string): number {
	const [w, h] = ratio.split(':').map(Number);
	return w > 0 && h > 0 ? w / h : 1;
}

function hexToRgb(hex: string): [number, number, number] {
	const normalized = hex.replace('#', '');
	return [
		parseInt(normalized.slice(0, 2), 16),
		parseInt(normalized.slice(2, 4), 16),
		parseInt(normalized.slice(4, 6), 16)
	];
}
