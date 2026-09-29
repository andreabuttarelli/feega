export type MediaKind = 'image' | 'video';

export type DownloadFormat = {
	id: string;
	label: string;
	mime: string;
	extension: string;
	lossy: boolean;
	supported: (env: BrowserSupport) => boolean;
};

export type BrowserSupport = {
	avifEncodable?: boolean;
};

const IMAGE_FORMAT_TABLE: DownloadFormat[] = [
	{ id: 'original', label: 'Originale', mime: '', extension: '', lossy: false, supported: () => true },
	{ id: 'png', label: 'PNG', mime: 'image/png', extension: 'png', lossy: false, supported: () => true },
	{ id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', extension: 'jpeg', lossy: true, supported: () => true },
	{ id: 'webp', label: 'WebP', mime: 'image/webp', extension: 'webp', lossy: true, supported: () => true },
	{
		id: 'avif',
		label: 'AVIF',
		mime: 'image/avif',
		extension: 'avif',
		lossy: true,
		supported: (env) => env.avifEncodable !== false
	}
];

const VIDEO_FORMAT_TABLE: DownloadFormat[] = [
	{ id: 'mp4', label: 'MP4', mime: 'video/mp4', extension: 'mp4', lossy: false, supported: () => true },
	{ id: 'gif', label: 'GIF', mime: 'image/gif', extension: 'gif', lossy: true, supported: () => true }
];

export const IMAGE_FORMATS = IMAGE_FORMAT_TABLE;
export const VIDEO_FORMATS = VIDEO_FORMAT_TABLE;

export function formatsFor(kind: MediaKind, env: BrowserSupport = {}): DownloadFormat[] {
	const table = kind === 'image' ? IMAGE_FORMAT_TABLE : VIDEO_FORMAT_TABLE;
	return table.filter((format) => format.supported(env));
}

const SHORT_ID_LENGTH = 6;
const UNSAFE_FILENAME_CHARS = /[^a-z0-9-]+/g;

function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(UNSAFE_FILENAME_CHARS, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

export enum MediaOrigin {
	Generated = 'generated',
	Other = 'other'
}

const ORIGIN_SUFFIX: Readonly<Record<MediaOrigin, string>> = {
	[MediaOrigin.Generated]: '-ai-generated',
	[MediaOrigin.Other]: ''
};

export function buildDownloadFilename(input: {
	displayName: string | null;
	nodeId: string;
	nodeType?: string;
	extension: string;
	origin?: MediaOrigin;
}): string {
	const base = slugify(input.displayName || input.nodeType || 'file');
	const shortId = input.nodeId.slice(0, SHORT_ID_LENGTH);
	return `${base}-${shortId}${ORIGIN_SUFFIX[input.origin ?? MediaOrigin.Other]}.${input.extension}`;
}

const GIF_MAX_WIDTH = 640;
const GIF_MAX_FPS = 15;
const GIF_MAX_DURATION_S = 10;

export type GifPlan = { width: number; height: number; fps: number; durationS: number };

export function clampGifPlan(source: { width: number; height: number; durationS: number; fps: number }): GifPlan {
	const width = Math.min(source.width, GIF_MAX_WIDTH);
	const scale = width / source.width;
	const height = Math.round(source.height * scale);

	return {
		width,
		height,
		fps: Math.min(source.fps, GIF_MAX_FPS),
		durationS: Math.min(source.durationS, GIF_MAX_DURATION_S)
	};
}
