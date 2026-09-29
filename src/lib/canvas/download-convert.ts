import type { GifPlan } from './download';

const DEFAULT_LOSSY_QUALITY = 0.92;

export async function convertImageTo(
	sourceUrl: string,
	mime: string,
	quality: number = DEFAULT_LOSSY_QUALITY
): Promise<Blob> {
	const image = await loadImage(sourceUrl);
	const canvas = document.createElement('canvas');
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('canvas 2d unavailable');
	}
	ctx.drawImage(image, 0, 0);

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('image conversion failed'))),
			mime,
			quality
		);
	});
}

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.crossOrigin = 'anonymous';
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error('image could not load'));
		image.src = url;
	});
}

export type GifProgress = (fraction: number) => void;

export async function convertVideoToGif(
	sourceUrl: string,
	plan: GifPlan,
	onProgress?: GifProgress,
	isCancelled?: () => boolean
): Promise<Blob> {
	const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

	const video = await loadVideo(sourceUrl);
	const canvas = document.createElement('canvas');
	canvas.width = plan.width;
	canvas.height = plan.height;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) {
		throw new Error('canvas 2d unavailable');
	}

	const encoder = GIFEncoder();
	const frameDelayMs = Math.round(1000 / plan.fps);
	const totalFrames = Math.max(1, Math.round(plan.durationS * plan.fps));

	for (let i = 0; i < totalFrames; i++) {
		if (isCancelled?.()) {
			throw new DOMException('annullato', 'AbortError');
		}

		await seekTo(video, i / plan.fps);
		ctx.drawImage(video, 0, 0, plan.width, plan.height);

		const { data } = ctx.getImageData(0, 0, plan.width, plan.height);
		const palette = quantize(data, 256);
		const indexed = applyPalette(data, palette);
		encoder.writeFrame(indexed, plan.width, plan.height, { palette, delay: frameDelayMs });

		onProgress?.((i + 1) / totalFrames);
	}

	encoder.finish();
	return new Blob([encoder.bytes().slice().buffer], { type: 'image/gif' });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
	return new Promise((resolve, reject) => {
		const video = document.createElement('video');
		video.crossOrigin = 'anonymous';
		video.muted = true;
		video.playsInline = true;
		video.preload = 'auto';
		video.onloadedmetadata = () => resolve(video);
		video.onerror = () => reject(new Error('video could not load'));
		video.src = url;
	});
}

function seekTo(video: HTMLVideoElement, timeS: number): Promise<void> {
	return new Promise((resolve) => {
		video.onseeked = () => resolve();
		video.currentTime = Math.min(timeS, video.duration || timeS);
	});
}
