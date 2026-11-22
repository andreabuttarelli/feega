import { describe, expect, it } from 'vitest';
import {
	RASTER_IMAGE_ACCEPT,
	isHeicSource,
	isRasterImageSource,
	jpegFilename,
	sniffRasterKind
} from './raster-image';

describe('raster picker helpers', () => {
	it('lists HEIC in the image picker accept string', () => {
		expect(RASTER_IMAGE_ACCEPT).toContain('image/heic');
		expect(RASTER_IMAGE_ACCEPT).toContain('.heic');
	});

	it('treats iPhone HEIC filenames as rasters even with an empty mime', () => {
		expect(isRasterImageSource({ mime: '', filename: 'IMG_0002.HEIC' })).toBe(true);
		expect(isHeicSource({ mime: '', filename: 'photo.heif' })).toBe(true);
		expect(sniffRasterKind(new Uint8Array(), 'image/heic', '')).toBe('heic');
		expect(isRasterImageSource({ mime: 'image/png', filename: 'logo.png' })).toBe(true);
		expect(isRasterImageSource({ mime: 'application/pdf', filename: 'x.pdf' })).toBe(false);
	});

	it('does not treat an SVG as a raster', () => {
		expect(sniffRasterKind(new Uint8Array(), 'image/svg+xml', 'logo.svg')).toBe('unknown');
		expect(isRasterImageSource({ mime: 'image/svg+xml', filename: 'logo.svg' })).toBe(false);
	});

	it('rewrites HEIC names to .jpg', () => {
		expect(jpegFilename('IMG_0002.HEIC')).toBe('IMG_0002.jpg');
		expect(jpegFilename('logo.png')).toBe('logo.jpg');
	});
});
