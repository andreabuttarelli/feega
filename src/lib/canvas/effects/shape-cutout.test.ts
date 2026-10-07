import { describe, expect, it } from 'vitest';
import { apply, counterpart, hasCutout, layoutCutout } from './shape-cutout';
import { contains } from './shapes';
import { makePixels, pixelAt } from './test-helpers';

const params = { side: 'shapes', shapes: 'mix', count: 8, size: 14, sizeSpread: 40, radius: 40, style: 'fill', strokeWidth: 3, shapeColor: '#ff0000', fillColor: '#00ff00', seed: 3 };

const image = makePixels(120, 80, (x, y) => [x * 2, y * 3, 90, 255]);

function centreOf(shape: { x: number; y: number; w: number; h: number }) {
	return { x: Math.floor(shape.x + shape.w / 2), y: Math.floor(shape.y + shape.h / 2) };
}

describe('shape cutout layout', () => {
	it('is deterministic from the seed', () => {
		expect(layoutCutout(120, 80, params)).toEqual(layoutCutout(120, 80, params));
		expect(layoutCutout(120, 80, { ...params, seed: 4 })).not.toEqual(layoutCutout(120, 80, params));
	});

	it('places shapes inside the image, apart from each other', () => {
		const shapes = layoutCutout(120, 80, params);

		expect(shapes.length).toBeGreaterThan(0);
		for (const s of shapes) {
			expect(s.x).toBeGreaterThanOrEqual(0);
			expect(s.y).toBeGreaterThanOrEqual(0);
			expect(s.x + s.w).toBeLessThanOrEqual(120);
			expect(s.y + s.h).toBeLessThanOrEqual(80);
		}
		for (let i = 0; i < shapes.length; i++) {
			for (let j = i + 1; j < shapes.length; j++) {
				const a = shapes[i];
				const b = shapes[j];
				expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
			}
		}
	});
});

describe('shape cutout A/B', () => {
	it('A and B share the same geometry: A paints where B opens a hole', () => {
		const a = apply(image, params);
		const b = apply(image, { ...params, side: 'holes' });
		const shapes = layoutCutout(120, 80, params);

		for (const shape of shapes) {
			const { x, y } = centreOf(shape);
			expect(pixelAt(a, x, y)).toEqual([255, 0, 0, 255]);
			expect(pixelAt(b, x, y)).toEqual(pixelAt(image, x, y));
		}

		for (let y = 0; y < 80; y += 3) {
			for (let x = 0; x < 120; x += 3) {
				const inside = shapes.some((s) => [0, 1].every((dx) => [0, 1].every((dy) => contains(s, x + dx, y + dy) && contains(s, x + dx, y + 1 - dy))));
				const outside = !shapes.some((s) => x + 1 >= s.x && y + 1 >= s.y && x <= s.x + s.w && y <= s.y + s.h);
				if (outside) {
					expect(pixelAt(a, x, y)).toEqual(pixelAt(image, x, y));
					expect(pixelAt(b, x, y)).toEqual([0, 255, 0, 255]);
				}
				if (inside) {
					expect(pixelAt(b, x, y)).toEqual(pixelAt(image, x, y));
				}
			}
		}
	});

	it('outline style leaves the inside of a shape untouched', () => {
		const a = apply(image, { ...params, style: 'outline', shapes: 'square', size: 30, count: 1 });
		const [shape] = layoutCutout(120, 80, { ...params, shapes: 'square', size: 30, count: 1 });
		const { x, y } = centreOf(shape);

		expect(pixelAt(a, x, y)).toEqual(pixelAt(image, x, y));
		expect(pixelAt(a, Math.floor(shape.x) + 1, y)).toEqual([255, 0, 0, 255]);
	});

	it('counterpart flips only the cutout side', () => {
		const steps = [
			{ id: 'posterize' as const, params: { levels: 4 }, enabled: true },
			{ id: 'shape-cutout' as const, params, enabled: true }
		];

		const flipped = counterpart(steps);

		expect(flipped[0]).toEqual(steps[0]);
		expect(flipped[1].params.side).toBe('holes');
		expect(counterpart(flipped)).toEqual(steps);
		expect(hasCutout(steps)).toBe(true);
		expect(hasCutout([steps[0]])).toBe(false);
	});
});
