import type { CompositionAspect } from '../composition-node';

export type ExportResolution = '720p' | '1080p';

const OUTPUT_SIZES: Record<CompositionAspect, Record<ExportResolution, { width: number; height: number }>> = {
	'9:16': { '720p': { width: 720, height: 1280 }, '1080p': { width: 1080, height: 1920 } },
	'1:1': { '720p': { width: 720, height: 720 }, '1080p': { width: 1080, height: 1080 } },
	'16:9': { '720p': { width: 1280, height: 720 }, '1080p': { width: 1920, height: 1080 } }
};

export function outputSizeFor(aspect: CompositionAspect, resolution: ExportResolution): { width: number; height: number } {
	return OUTPUT_SIZES[aspect][resolution];
}

export function frameCount(durationS: number, fps: number): number {
	return Math.max(1, Math.round(durationS * fps));
}

export function frameTimestampsS(frames: number, fps: number): number[] {
	return Array.from({ length: frames }, (_, i) => i / fps);
}

const BITS_PER_PIXEL_PER_SECOND = 0.09;

export type VideoEncoderConfigLike = {
	codec: string;
	width: number;
	height: number;
	framerate: number;
	bitrate: number;
};

export function encoderConfigFor(size: { width: number; height: number }, fps: number): VideoEncoderConfigLike {
	return {
		codec: 'avc1.640028',
		width: size.width,
		height: size.height,
		framerate: fps,
		bitrate: Math.round(size.width * size.height * fps * BITS_PER_PIXEL_PER_SECOND)
	};
}
