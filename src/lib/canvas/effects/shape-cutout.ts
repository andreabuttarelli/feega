import { mulberry32 } from './seeded-random';
import { contains, hexToRgba, inset, kindsOf, makeShape, paint, pickKind, type Rgba, type Shape } from './shapes';
import type { EffectStep, Pixels } from './types';

type Params = Record<string, number | string>;

export enum CutoutSide {
	Shapes = 'shapes',
	Holes = 'holes'
}

export enum CutoutStyle {
	Fill = 'fill',
	Outline = 'outline'
}

export const CUTOUT_SIDE_OPTIONS = [
	{ value: CutoutSide.Shapes, label: 'A · Forme sopra' },
	{ value: CutoutSide.Holes, label: 'B · Fori nel pieno' }
];

export const CUTOUT_STYLE_OPTIONS = [
	{ value: CutoutStyle.Fill, label: 'Pieno' },
	{ value: CutoutStyle.Outline, label: 'Contorno' }
];

export const CUTOUT_EFFECT_ID = 'shape-cutout';

const ATTEMPTS_PER_SHAPE = 300;
const SPACING_RATIO = 0.35;
const PERCENT = 100;
const PAPER: Rgba = [244, 241, 234, 255];

export function layoutCutout(width: number, height: number, params: Params): Shape[] {
	const count = Math.max(1, Math.round(Number(params.count) || 1));
	const side = Math.min(width, height);
	const base = (side * (Number(params.size) || 1)) / PERCENT;
	const spread = (Number(params.sizeSpread) || 0) / PERCENT;
	const roundness = (Number(params.radius) || 0) / PERCENT;
	const kinds = kindsOf(params.shapes);
	const spacing = base * SPACING_RATIO;
	const random = mulberry32(Math.round(Number(params.seed) || 0));
	const placed: Shape[] = [];

	for (let attempt = 0; attempt < count * ATTEMPTS_PER_SHAPE && placed.length < count; attempt++) {
		const kind = pickKind(kinds, random);
		const scale = 1 + spread * (random() * 2 - 1) * 0.5;
		const w = Math.min(side - spacing * 2, base * scale);
		const h = kind === 'circle' ? w : Math.min(side - spacing * 2, base * scale);
		const x = spacing + random() * (width - w - spacing * 2);
		const y = spacing + random() * (height - h - spacing * 2);
		const shape = makeShape(kind, x, y, w, h, roundness);

		if (w > 0 && !placed.some((other) => near(shape, other, spacing))) {
			placed.push(shape);
		}
	}

	return placed;
}

export function apply(pixels: Pixels, params: Params): Pixels {
	const shapes = layoutCutout(pixels.width, pixels.height, params);
	return params.side === CutoutSide.Holes ? holes(pixels, shapes, params) : overlay(pixels, shapes, params);
}

export function counterpart(steps: EffectStep[]): EffectStep[] {
	return steps.map((step) =>
		step.id === CUTOUT_EFFECT_ID
			? { ...step, params: { ...step.params, side: step.params.side === CutoutSide.Holes ? CutoutSide.Shapes : CutoutSide.Holes } }
			: step
	);
}

export function hasCutout(steps: EffectStep[]): boolean {
	return steps.some((step) => step.enabled && step.id === CUTOUT_EFFECT_ID);
}

function overlay(pixels: Pixels, shapes: Shape[], params: Params): Pixels {
	const out = { width: pixels.width, height: pixels.height, data: new Uint8ClampedArray(pixels.data) };
	const color = hexToRgba(params.shapeColor, PAPER);
	const stroke = Math.max(1, Number(params.strokeWidth) || 1);

	for (const shape of shapes) {
		const hollow = inset(shape, stroke);
		const test =
			params.style === CutoutStyle.Outline
				? (px: number, py: number) => contains(shape, px, py) && !contains(hollow, px, py)
				: (px: number, py: number) => contains(shape, px, py);
		paint(out, test, shape, color);
	}

	return out;
}

function holes(pixels: Pixels, shapes: Shape[], params: Params): Pixels {
	const out = { width: pixels.width, height: pixels.height, data: new Uint8ClampedArray(pixels.data) };
	const whole: Shape = { kind: 'square', x: 0, y: 0, w: pixels.width, h: pixels.height, radius: 0 };
	const solid = (px: number, py: number) => !shapes.some((shape) => contains(shape, px, py));

	paint(out, solid, whole, hexToRgba(params.fillColor, PAPER));
	return out;
}

function near(a: Shape, b: Shape, spacing: number): boolean {
	return (
		a.x < b.x + b.w + spacing &&
		b.x < a.x + a.w + spacing &&
		a.y < b.y + b.h + spacing &&
		b.y < a.y + a.h + spacing
	);
}
