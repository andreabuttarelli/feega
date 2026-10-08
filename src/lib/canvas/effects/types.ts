export type EffectId =
	| 'pixelate'
	| 'posterize'
	| 'random-colors'
	| 'hue-saturation'
	| 'duotone'
	| 'dither'
	| 'halftone'
	| 'noise'
	| 'rgb-shift'
	| 'glitch'
	| 'wave'
	| 'swirl'
	| 'pinch'
	| 'ascii'
	| 'shape-mosaic'
	| 'shape-cutout';

export type EffectParam =
	| { name: string; label: string; kind: 'range'; min: number; max: number; step: number; default: number }
	| { name: string; label: string; kind: 'select'; options: { value: string; label: string }[]; default: string }
	| { name: string; label: string; kind: 'color'; default: string }
	| { name: string; label: string; kind: 'seed'; default: number };

export type BuiltinStep = {
	id: EffectId;
	params: Record<string, number | string>;
	enabled: boolean;
};

export const CUSTOM = 'custom';

export type CustomStep = {
	id: typeof CUSTOM;
	ref: string;
	params: Record<string, number | string>;
	enabled: boolean;
};

export type EffectStep = BuiltinStep | CustomStep;

export type CustomPass = (pixels: Pixels, step: CustomStep) => Pixels;

export type Pixels = {
	width: number;
	height: number;
	data: Uint8ClampedArray;
};
