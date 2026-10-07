import { apply as applyAscii } from './ascii';
import { apply as applyDither } from './dither';
import { apply as applyDuotone } from './duotone';
import { apply as applyGlitch } from './glitch';
import { apply as applyHalftone } from './halftone';
import { apply as applyHueSaturation } from './hue-saturation';
import { apply as applyNoise } from './noise';
import { apply as applyPinch } from './pinch';
import { apply as applyPixelate } from './pixelate';
import { apply as applyPosterize } from './posterize';
import { apply as applyRandomColors } from './random-colors';
import { apply as applyRgbShift } from './rgb-shift';
import { apply as applyShapeCutout, CUTOUT_SIDE_OPTIONS, CUTOUT_STYLE_OPTIONS, CutoutSide, CutoutStyle } from './shape-cutout';
import { apply as applyShapeMosaic, MOSAIC_BACKGROUND_OPTIONS, MosaicBackground } from './shape-mosaic';
import { SHAPE_SET_OPTIONS } from './shapes';
import { apply as applySwirl } from './swirl';
import type { EffectId, EffectParam, EffectStep, Pixels } from './types';
import { apply as applyWave } from './wave';

type EffectDefinition = {
	label: string;
	params: EffectParam[];
	apply: (pixels: Pixels, params: Record<string, number | string>) => Pixels;
};

export const EFFECTS: Record<EffectId, EffectDefinition> = {
	pixelate: {
		label: 'Pixellizza',
		params: [{ name: 'blockSize', label: 'Dimensione blocco', kind: 'range', min: 1, max: 64, step: 1, default: 8 }],
		apply: applyPixelate
	},
	posterize: {
		label: 'Posterizza',
		params: [{ name: 'levels', label: 'Livelli', kind: 'range', min: 2, max: 16, step: 1, default: 4 }],
		apply: applyPosterize
	},
	'random-colors': {
		label: 'Colori casuali',
		params: [{ name: 'seed', label: 'Seed', kind: 'seed', default: 1 }],
		apply: applyRandomColors
	},
	'hue-saturation': {
		label: 'Tonalità e saturazione',
		params: [
			{ name: 'hue', label: 'Tonalità', kind: 'range', min: -180, max: 180, step: 1, default: 0 },
			{ name: 'saturation', label: 'Saturazione', kind: 'range', min: 0, max: 2, step: 0.05, default: 1 }
		],
		apply: applyHueSaturation
	},
	duotone: {
		label: 'Duotono',
		params: [
			{ name: 'shadow', label: 'Colore ombre', kind: 'color', default: '#000000' },
			{ name: 'highlight', label: 'Colore luci', kind: 'color', default: '#ffffff' }
		],
		apply: applyDuotone
	},
	dither: {
		label: 'Retinatura',
		params: [
			{
				name: 'mode',
				label: 'Modalità',
				kind: 'select',
				options: [
					{ value: 'floyd-steinberg', label: 'Floyd–Steinberg' },
					{ value: 'ordered', label: 'Ordinata (Bayer)' }
				],
				default: 'floyd-steinberg'
			}
		],
		apply: applyDither
	},
	halftone: {
		label: 'Retino',
		params: [{ name: 'dotSize', label: 'Dimensione punto', kind: 'range', min: 2, max: 32, step: 1, default: 6 }],
		apply: applyHalftone
	},
	noise: {
		label: 'Rumore',
		params: [
			{ name: 'amount', label: 'Quantità', kind: 'range', min: 0, max: 255, step: 1, default: 40 },
			{ name: 'seed', label: 'Seed', kind: 'seed', default: 1 }
		],
		apply: applyNoise
	},
	'rgb-shift': {
		label: 'Spostamento RGB',
		params: [
			{ name: 'rx', label: 'Rosso X', kind: 'range', min: -50, max: 50, step: 1, default: 4 },
			{ name: 'ry', label: 'Rosso Y', kind: 'range', min: -50, max: 50, step: 1, default: 0 },
			{ name: 'gx', label: 'Verde X', kind: 'range', min: -50, max: 50, step: 1, default: 0 },
			{ name: 'gy', label: 'Verde Y', kind: 'range', min: -50, max: 50, step: 1, default: 0 },
			{ name: 'bx', label: 'Blu X', kind: 'range', min: -50, max: 50, step: 1, default: -4 },
			{ name: 'by', label: 'Blu Y', kind: 'range', min: -50, max: 50, step: 1, default: 0 }
		],
		apply: applyRgbShift
	},
	glitch: {
		label: 'Glitch',
		params: [
			{ name: 'amount', label: 'Quantità', kind: 'range', min: 0, max: 100, step: 1, default: 10 },
			{ name: 'sliceHeight', label: 'Altezza fascia', kind: 'range', min: 1, max: 64, step: 1, default: 6 },
			{ name: 'seed', label: 'Seed', kind: 'seed', default: 1 }
		],
		apply: applyGlitch
	},
	wave: {
		label: 'Onda',
		params: [
			{ name: 'amplitude', label: 'Ampiezza', kind: 'range', min: 0, max: 64, step: 1, default: 8 },
			{ name: 'frequency', label: 'Frequenza', kind: 'range', min: 0.1, max: 10, step: 0.1, default: 2 },
			{
				name: 'direction',
				label: 'Direzione',
				kind: 'select',
				options: [
					{ value: 'horizontal', label: 'Orizzontale' },
					{ value: 'vertical', label: 'Verticale' }
				],
				default: 'horizontal'
			}
		],
		apply: applyWave
	},
	swirl: {
		label: 'Vortice',
		params: [
			{ name: 'strength', label: 'Intensità', kind: 'range', min: -10, max: 10, step: 0.1, default: 3 },
			{ name: 'radius', label: 'Raggio', kind: 'range', min: 1, max: 500, step: 1, default: 100 }
		],
		apply: applySwirl
	},
	pinch: {
		label: 'Pizzico',
		params: [
			{ name: 'strength', label: 'Intensità', kind: 'range', min: -1, max: 1, step: 0.05, default: 0.5 },
			{ name: 'radius', label: 'Raggio', kind: 'range', min: 1, max: 500, step: 1, default: 100 }
		],
		apply: applyPinch
	},
	ascii: {
		label: 'ASCII art',
		params: [
			{ name: 'cellSize', label: 'Dimensione cella', kind: 'range', min: 5, max: 40, step: 1, default: 10 },
			{
				name: 'charset',
				label: 'Set di caratteri',
				kind: 'select',
				options: [
					{ value: 'default', label: 'Predefinito' },
					{ value: 'blocks', label: 'Blocchi' },
					{ value: 'minimal', label: 'Minimo' }
				],
				default: 'default'
			},
			{
				name: 'mode',
				label: 'Colore',
				kind: 'select',
				options: [
					{ value: 'mono', label: 'Monocromo' },
					{ value: 'color', label: 'A colori' }
				],
				default: 'mono'
			}
		],
		apply: applyAscii
	},
	'shape-mosaic': {
		label: 'Mosaico di forme',
		params: [
			{ name: 'shapes', label: 'Forme', kind: 'select', options: SHAPE_SET_OPTIONS, default: 'mix' },
			{ name: 'minSize', label: 'Dimensione minima', kind: 'range', min: 2, max: 128, step: 1, default: 10 },
			{ name: 'maxSize', label: 'Dimensione massima', kind: 'range', min: 4, max: 256, step: 1, default: 64 },
			{ name: 'detail', label: 'Dettaglio adattivo', kind: 'range', min: 0, max: 100, step: 1, default: 70 },
			{ name: 'gap', label: 'Spazio', kind: 'range', min: 0, max: 32, step: 1, default: 3 },
			{ name: 'radius', label: 'Raggio arrotondati', kind: 'range', min: 0, max: 100, step: 1, default: 40 },
			{ name: 'jitter', label: 'Jitter', kind: 'range', min: 0, max: 100, step: 1, default: 0 },
			{ name: 'background', label: 'Sfondo', kind: 'select', options: MOSAIC_BACKGROUND_OPTIONS, default: MosaicBackground.Average },
			{ name: 'backgroundColor', label: 'Colore sfondo', kind: 'color', default: '#ffffff' },
			{ name: 'seed', label: 'Seed', kind: 'seed', default: 1 }
		],
		apply: applyShapeMosaic
	},
	'shape-cutout': {
		label: 'Ritaglio di forme (A/B)',
		params: [
			{ name: 'side', label: 'Uscita', kind: 'select', options: CUTOUT_SIDE_OPTIONS, default: CutoutSide.Shapes },
			{ name: 'shapes', label: 'Forme', kind: 'select', options: SHAPE_SET_OPTIONS, default: 'mix' },
			{ name: 'count', label: 'Numero', kind: 'range', min: 1, max: 40, step: 1, default: 6 },
			{ name: 'size', label: 'Dimensione (%)', kind: 'range', min: 4, max: 60, step: 1, default: 18 },
			{ name: 'sizeSpread', label: 'Variazione dimensione', kind: 'range', min: 0, max: 100, step: 1, default: 40 },
			{ name: 'radius', label: 'Raggio arrotondati', kind: 'range', min: 0, max: 100, step: 1, default: 40 },
			{ name: 'style', label: 'Stile forme', kind: 'select', options: CUTOUT_STYLE_OPTIONS, default: CutoutStyle.Fill },
			{ name: 'strokeWidth', label: 'Spessore contorno', kind: 'range', min: 1, max: 32, step: 1, default: 4 },
			{ name: 'shapeColor', label: 'Colore forme', kind: 'color', default: '#f4f1ea' },
			{ name: 'fillColor', label: 'Colore riempimento', kind: 'color', default: '#f4f1ea' },
			{ name: 'seed', label: 'Seed', kind: 'seed', default: 1 }
		],
		apply: applyShapeCutout
	}
};

function clampParams(id: EffectId, params: Record<string, number | string>): Record<string, number | string> {
	const definition = EFFECTS[id];
	const clamped: Record<string, number | string> = { ...params };

	for (const param of definition.params) {
		const value = clamped[param.name];

		if (param.kind === 'range' && typeof value === 'number') {
			clamped[param.name] = Math.min(param.max, Math.max(param.min, value));
		}
	}

	return clamped;
}

export function applyStack(pixels: Pixels, steps: EffectStep[]): Pixels {
	let current = pixels;

	for (const step of steps) {
		const definition = EFFECTS[step.id];
		if (!definition || !step.enabled) {
			continue;
		}

		current = definition.apply(current, clampParams(step.id, step.params));
	}

	return current;
}

export type { EffectId, EffectParam, EffectStep, Pixels };
