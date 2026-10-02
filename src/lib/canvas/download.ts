import { MODEL3D_MIME } from '$lib/model3d-models';

export type MediaKind = 'image' | 'video' | 'model3d';

export type DownloadFormat = {
	id: string;
	label: string;
	mime: string;
	extension: string;
	lossy: boolean;
	asStored: boolean;
	supported: (env: BrowserSupport) => boolean;
};

export type BrowserSupport = {
	avifEncodable?: boolean;
};

const IMAGE_FORMAT_TABLE: DownloadFormat[] = [
	{ id: 'original', label: 'Originale', mime: '', extension: '', lossy: false, asStored: true, supported: () => true },
	{ id: 'png', label: 'PNG', mime: 'image/png', extension: 'png', lossy: false, asStored: false, supported: () => true },
	{ id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', extension: 'jpeg', lossy: true, asStored: false, supported: () => true },
	{ id: 'webp', label: 'WebP', mime: 'image/webp', extension: 'webp', lossy: true, asStored: false, supported: () => true },
	{
		id: 'avif',
		label: 'AVIF',
		mime: 'image/avif',
		extension: 'avif',
		lossy: true,
		asStored: false,
		supported: (env) => env.avifEncodable !== false
	}
];

const VIDEO_FORMAT_TABLE: DownloadFormat[] = [
	{ id: 'mp4', label: 'MP4', mime: 'video/mp4', extension: 'mp4', lossy: false, asStored: true, supported: () => true },
	{ id: 'gif', label: 'GIF', mime: 'image/gif', extension: 'gif', lossy: true, asStored: false, supported: () => true }
];

const MODEL3D_FORMAT_TABLE: DownloadFormat[] = [
	{ id: 'glb', label: 'GLB', mime: MODEL3D_MIME, extension: 'glb', lossy: false, asStored: true, supported: () => true }
];

const FORMAT_TABLE: Record<MediaKind, DownloadFormat[]> = {
	image: IMAGE_FORMAT_TABLE,
	video: VIDEO_FORMAT_TABLE,
	model3d: MODEL3D_FORMAT_TABLE
};

export const IMAGE_FORMATS = IMAGE_FORMAT_TABLE;
export const VIDEO_FORMATS = VIDEO_FORMAT_TABLE;

export function formatsFor(kind: MediaKind, env: BrowserSupport = {}): DownloadFormat[] {
	return FORMAT_TABLE[kind].filter((format) => format.supported(env));
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

export type DownloadFile = { id: string; label: string; url: string; filename: string };

const AUDIO_NODE_FILES = [
	{ id: 'video', label: 'Video (MP4)', extension: 'mp4', urlOf: (u: AudioNodeUrls) => u.videoUrl },
	{ id: 'audio', label: 'Audio (MP3)', extension: 'mp3', urlOf: (u: AudioNodeUrls) => u.audioUrl }
] as const;

type AudioNodeUrls = { videoUrl: string | null; audioUrl: string | null };

export function audioNodeFiles(input: AudioNodeUrls & { nodeId: string; displayName: string | null; language: string | null }): DownloadFile[] {
	const displayName = [input.displayName || 'audio', input.language].filter(Boolean).join(' ');
	return AUDIO_NODE_FILES.flatMap((file) => {
		const url = file.urlOf(input);
		if (!url) {
			return [];
		}
		const filename = buildDownloadFilename({ displayName, nodeId: input.nodeId, nodeType: 'audio', extension: file.extension, origin: MediaOrigin.Generated });
		return [{ id: file.id, label: file.label, url, filename }];
	});
}
