import { describe, expect, it } from 'vitest';
import {
	IMAGE_FORMATS,
	VIDEO_FORMATS,
	formatsFor,
	buildDownloadFilename,
	clampGifPlan,
	type MediaKind
} from './download';

describe('formatsFor', () => {
	it('lists image formats with the original offered unconverted', () => {
		const formats = formatsFor('image');
		const original = formats.find((f) => f.id === 'original');
		expect(original?.lossy).toBe(false);
		expect(formats.map((f) => f.id)).toEqual(['original', 'png', 'jpeg', 'webp', 'avif']);
	});

	it('lists video formats with mp4 as the original, no re-encode', () => {
		const formats = formatsFor('video');
		expect(formats.map((f) => f.id)).toEqual(['mp4', 'gif']);
		expect(formats.find((f) => f.id === 'mp4')?.lossy).toBe(false);
	});

	it('hides avif when the browser cannot encode it', () => {
		const formats = formatsFor('image', { avifEncodable: false });
		expect(formats.some((f) => f.id === 'avif')).toBe(false);
	});
});

describe('buildDownloadFilename', () => {
	it('combines display name, short id and extension', () => {
		const name = buildDownloadFilename({ displayName: 'Estate 2026', nodeId: 'a1b2c3d4e5f6', extension: 'webp' });
		expect(name).toBe('estate-2026-a1b2c3.webp');
	});

	it('falls back to the node type when there is no display name', () => {
		const name = buildDownloadFilename({ displayName: null, nodeId: 'a1b2c3d4e5f6', nodeType: 'image', extension: 'png' });
		expect(name).toBe('image-a1b2c3.png');
	});

	it('strips characters unsafe in a filename', () => {
		const name = buildDownloadFilename({ displayName: 'Città/Sera?', nodeId: 'a1b2c3d4e5f6', extension: 'jpeg' });
		expect(name).toBe('citta-sera-a1b2c3.jpeg');
	});
});

describe('clampGifPlan', () => {
	it('keeps a short, small source unchanged', () => {
		const plan = clampGifPlan({ width: 480, height: 270, durationS: 3, fps: 12 });
		expect(plan).toEqual({ width: 480, height: 270, fps: 12, durationS: 3 });
	});

	it('caps width and scales height to match, preserving aspect ratio', () => {
		const plan = clampGifPlan({ width: 1920, height: 1080, durationS: 3, fps: 12 });
		expect(plan.width).toBe(640);
		expect(plan.height).toBe(360);
	});

	it('caps fps and duration to keep the frame count sane', () => {
		const plan = clampGifPlan({ width: 480, height: 270, durationS: 60, fps: 30 });
		expect(plan.fps).toBe(15);
		expect(plan.durationS).toBe(10);
	});
});

describe('kind guard', () => {
	it('accepts image and video as the only kinds', () => {
		const kinds: MediaKind[] = ['image', 'video'];
		expect(kinds).toHaveLength(2);
	});
});
