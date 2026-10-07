import { describe, expect, it } from 'vitest';
import { apply, layoutMosaic, mosaicSvg } from './shape-mosaic';
import { meanColor } from './shapes';
import { makePixels, pixelAt } from './test-helpers';

const params = { shapes: 'mix', minSize: 4, maxSize: 16, detail: 70, gap: 2, radius: 40, jitter: 50, background: 'average', backgroundColor: '#ffffff', seed: 7 };

const halves = makePixels(64, 32, (x) => (x < 32 ? [200, 40, 40, 255] : [20, 60, 200, 255]));
const busy = makePixels(64, 64, (x, y) => (x > 32 && (x + y) % 2 === 0 ? [255, 255, 255, 255] : [0, 0, 0, 255]));

describe('shape mosaic layout', () => {
	it('is the same for the same seed and changes with another seed', () => {
		const first = layoutMosaic(busy, params);
		const again = layoutMosaic(busy, params);
		const other = layoutMosaic(busy, { ...params, seed: 8 });

		expect(again).toEqual(first);
		expect(other.tiles).not.toEqual(first.tiles);
	});

	it('keeps every shape inside the image', () => {
		for (const { shape } of layoutMosaic(busy, params).tiles) {
			expect(shape.x).toBeGreaterThanOrEqual(0);
			expect(shape.y).toBeGreaterThanOrEqual(0);
			expect(shape.x + shape.w).toBeLessThanOrEqual(busy.width);
			expect(shape.y + shape.h).toBeLessThanOrEqual(busy.height);
		}
	});

	it('never overlaps two shapes', () => {
		const tiles = layoutMosaic(busy, params).tiles.map((t) => t.shape);

		for (let i = 0; i < tiles.length; i++) {
			for (let j = i + 1; j < tiles.length; j++) {
				const a = tiles[i];
				const b = tiles[j];
				const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
				expect(apart).toBe(true);
			}
		}
	});

	it('uses smaller shapes where there is detail', () => {
		const tiles = layoutMosaic(busy, { ...params, jitter: 0 }).tiles;
		const flat = tiles.filter((t) => t.shape.x + t.shape.w <= 32).map((t) => t.shape.w);
		const detailed = tiles.filter((t) => t.shape.x > 32).map((t) => t.shape.w);

		expect(Math.max(...detailed)).toBeLessThan(Math.min(...flat));
	});

	it('colours each shape with the mean colour of its own area', () => {
		for (const { shape, color } of layoutMosaic(halves, params).tiles) {
			expect(color).toEqual(meanColor(halves, shape));
		}
		const left = layoutMosaic(halves, params).tiles.find((t) => t.shape.x + t.shape.w <= 32)!;
		expect(left.color).toEqual([200, 40, 40, 255]);
	});

	it('paints a transparent background when asked', () => {
		const out = apply(halves, { ...params, gap: 8, shapes: 'circle', background: 'transparent' });

		expect(pixelAt(out, 0, 0)[3]).toBe(0);
		expect(pixelAt(out, 8, 8)).toEqual([200, 40, 40, 255]);
	});

	it('exports the same shapes as vector SVG', () => {
		const svg = mosaicSvg(halves, params);
		const count = (svg.match(/<(rect|circle) /g) ?? []).length;

		expect(svg.startsWith('<svg')).toBe(true);
		expect(count).toBe(layoutMosaic(halves, params).tiles.length + 1);
	});
});
