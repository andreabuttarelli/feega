import type { Pixels } from './types';

export type ShapeKind = 'square' | 'circle' | 'rounded';

export type Shape = {
	kind: ShapeKind;
	x: number;
	y: number;
	w: number;
	h: number;
	radius: number;
};

export type Rgba = [number, number, number, number];

export const SHAPE_SETS: Record<string, { label: string; kinds: ShapeKind[] }> = {
	mix: { label: 'Mix', kinds: ['square', 'circle', 'rounded'] },
	square: { label: 'Quadrati', kinds: ['square'] },
	circle: { label: 'Cerchi', kinds: ['circle'] },
	rounded: { label: 'Arrotondati', kinds: ['rounded'] },
	'circle-square': { label: 'Cerchi e quadrati', kinds: ['circle', 'square'] }
};

export const SHAPE_SET_OPTIONS = Object.entries(SHAPE_SETS).map(([value, set]) => ({ value, label: set.label }));

const SUBSAMPLES = [0.25, 0.75];

export function kindsOf(set: unknown): ShapeKind[] {
	return (SHAPE_SETS[String(set)] ?? SHAPE_SETS.mix).kinds;
}

export function pickKind(kinds: ShapeKind[], random: () => number): ShapeKind {
	return kinds[Math.min(kinds.length - 1, Math.floor(random() * kinds.length))];
}

export function makeShape(kind: ShapeKind, x: number, y: number, w: number, h: number, roundness: number): Shape {
	const side = Math.min(w, h);

	if (kind === 'circle') {
		return { kind, x: x + (w - side) / 2, y: y + (h - side) / 2, w: side, h: side, radius: side / 2 };
	}

	const radius = kind === 'rounded' ? (side / 2) * roundness : 0;
	return { kind, x, y, w, h, radius };
}

export function contains(shape: Shape, px: number, py: number): boolean {
	if (px < shape.x || py < shape.y || px > shape.x + shape.w || py > shape.y + shape.h) {
		return false;
	}

	const r = shape.radius;
	const cx = Math.min(Math.max(px, shape.x + r), shape.x + shape.w - r);
	const cy = Math.min(Math.max(py, shape.y + r), shape.y + shape.h - r);
	const dx = px - cx;
	const dy = py - cy;
	return dx * dx + dy * dy <= r * r;
}

export function inset(shape: Shape, by: number): Shape {
	const w = Math.max(0, shape.w - by * 2);
	const h = Math.max(0, shape.h - by * 2);
	return { ...shape, x: shape.x + by, y: shape.y + by, w, h, radius: Math.max(0, shape.radius - by) };
}

export function coverage(test: (px: number, py: number) => boolean, x: number, y: number): number {
	let hits = 0;

	for (const sy of SUBSAMPLES) {
		for (const sx of SUBSAMPLES) {
			if (test(x + sx, y + sy)) {
				hits++;
			}
		}
	}

	return hits / (SUBSAMPLES.length * SUBSAMPLES.length);
}

export function blendAt(data: Uint8ClampedArray, i: number, color: Rgba, amount: number): void {
	const alpha = (color[3] / 255) * amount;
	if (alpha <= 0) {
		return;
	}

	const below = data[i + 3] / 255;
	const outAlpha = alpha + below * (1 - alpha);

	for (let c = 0; c < 3; c++) {
		const mixed = color[c] * alpha + data[i + c] * below * (1 - alpha);
		data[i + c] = outAlpha > 0 ? mixed / outAlpha : 0;
	}
	data[i + 3] = outAlpha * 255;
}

export function paint(target: Pixels, test: (px: number, py: number) => boolean, bounds: Shape, color: Rgba): void {
	const x0 = Math.max(0, Math.floor(bounds.x));
	const y0 = Math.max(0, Math.floor(bounds.y));
	const x1 = Math.min(target.width, Math.ceil(bounds.x + bounds.w));
	const y1 = Math.min(target.height, Math.ceil(bounds.y + bounds.h));

	for (let y = y0; y < y1; y++) {
		for (let x = x0; x < x1; x++) {
			const amount = coverage(test, x, y);
			if (amount > 0) {
				blendAt(target.data, (y * target.width + x) * 4, color, amount);
			}
		}
	}
}

export function meanColor(pixels: Pixels, area: { x: number; y: number; w: number; h: number }): Rgba {
	const x0 = Math.max(0, Math.floor(area.x));
	const y0 = Math.max(0, Math.floor(area.y));
	const x1 = Math.min(pixels.width, Math.max(x0 + 1, Math.ceil(area.x + area.w)));
	const y1 = Math.min(pixels.height, Math.max(y0 + 1, Math.ceil(area.y + area.h)));
	const sum = [0, 0, 0, 0];
	let count = 0;

	for (let y = y0; y < y1; y++) {
		for (let x = x0; x < x1; x++) {
			const i = (y * pixels.width + x) * 4;
			for (let c = 0; c < 4; c++) {
				sum[c] += pixels.data[i + c];
			}
			count++;
		}
	}

	return sum.map((value) => Math.round(value / Math.max(1, count))) as Rgba;
}

export function hexToRgba(hex: unknown, fallback: Rgba): Rgba {
	const match = /^#([0-9a-f]{6})$/i.exec(String(hex));
	if (!match) {
		return fallback;
	}

	const value = parseInt(match[1], 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
}

export function rgbaToHex(color: Rgba): string {
	return `#${color.slice(0, 3).map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

export function blank(width: number, height: number, color: Rgba | null): Pixels {
	const data = new Uint8ClampedArray(width * height * 4);
	if (color) {
		for (let i = 0; i < data.length; i += 4) {
			data.set(color, i);
		}
	}
	return { width, height, data };
}

export function shapeSvg(shape: Shape, attributes: string): string {
	const f = (n: number) => Number(n.toFixed(2));

	if (shape.kind === 'circle') {
		return `<circle cx="${f(shape.x + shape.w / 2)}" cy="${f(shape.y + shape.h / 2)}" r="${f(shape.w / 2)}" ${attributes}/>`;
	}

	const corner = shape.radius > 0 ? ` rx="${f(shape.radius)}"` : '';
	return `<rect x="${f(shape.x)}" y="${f(shape.y)}" width="${f(shape.w)}" height="${f(shape.h)}"${corner} ${attributes}/>`;
}
