import { createCompositionScene, type CompositionSceneOptions } from './scene';
import { encoderConfigFor, frameCount, frameTimestampsS, outputSizeFor, type ExportResolution } from './export';
import type { CompositionAspect } from '../composition-node';

export type VideoExportFormat = 'mp4' | 'webm';

export async function canExportAvc(): Promise<boolean> {
	if (typeof VideoEncoder === 'undefined') {
		return false;
	}
	const { canEncodeVideo } = await import('mediabunny');
	return canEncodeVideo('avc');
}

export type EncodeVideoInput = {
	sceneOptions: Omit<CompositionSceneOptions, 'onTextureReady'>;
	aspect: CompositionAspect;
	resolution: ExportResolution;
	durationS: number;
	fps: number;
	onProgress?: (fraction: number) => void;
	isCancelled?: () => boolean;
};

export type EncodeVideoOutcome =
	| { outcome: 'encoded'; blob: Blob; format: VideoExportFormat }
	| { outcome: 'cancelled' }
	| { outcome: 'unsupported' };

/**
 * Renders the composition deterministically, frame by frame, on an offscreen canvas that no one
 * sees — a fresh scene built for export, kept apart from the one the editor's preview drives.
 * Prefers WebCodecs/avc1 through mediabunny; falls back to MediaRecorder/WebM where WebCodecs
 * (or that codec) isn't available, as on Firefox.
 */
export async function encodeCompositionVideo(input: EncodeVideoInput): Promise<EncodeVideoOutcome> {
	if (await canExportAvc()) {
		return encodeWithMediabunny(input);
	}
	if (typeof MediaRecorder !== 'undefined') {
		return encodeWithMediaRecorder(input);
	}
	return { outcome: 'unsupported' };
}

async function buildOffscreenScene(
	size: { width: number; height: number },
	options: Omit<CompositionSceneOptions, 'onTextureReady'>
) {
	const canvas = document.createElement('canvas');
	canvas.width = size.width;
	canvas.height = size.height;

	let readyCount = 0;
	const ready = new Promise<void>((resolve) => {
		const expected = options.media.length;
		if (expected === 0) {
			resolve();
			return;
		}
		const onTextureReady = () => {
			readyCount += 1;
			if (readyCount >= expected) {
				resolve();
			}
		};
		(options as CompositionSceneOptions).onTextureReady = onTextureReady;
	});

	const scene = createCompositionScene(canvas, options as CompositionSceneOptions);
	scene.resize(size.width, size.height);
	await ready;
	return { canvas, scene };
}

async function encodeWithMediabunny(input: EncodeVideoInput): Promise<EncodeVideoOutcome> {
	const { Output, Mp4OutputFormat, BufferTarget, CanvasSource } = await import('mediabunny');
	const size = outputSizeFor(input.aspect, input.resolution);
	const { canvas, scene } = await buildOffscreenScene(size, input.sceneOptions);
	const config = encoderConfigFor(size, input.fps);

	const target = new BufferTarget();
	const output = new Output({ format: new Mp4OutputFormat(), target });
	const source = new CanvasSource(canvas, { codec: 'avc', bitrate: config.bitrate });
	output.addVideoTrack(source);
	await output.start();

	try {
		const frames = frameCount(input.durationS, input.fps);
		const timestamps = frameTimestampsS(frames, input.fps);
		const frameDuration = 1 / input.fps;

		for (let i = 0; i < timestamps.length; i++) {
			if (input.isCancelled?.()) {
				await output.cancel();
				return { outcome: 'cancelled' };
			}

			scene.renderAt(timestamps[i]);
			await source.add(timestamps[i], frameDuration);
			input.onProgress?.((i + 1) / timestamps.length);
			await yieldToMainThread();
		}

		await output.finalize();
	} finally {
		scene.dispose();
	}

	if (!target.buffer) {
		return { outcome: 'unsupported' };
	}
	return { outcome: 'encoded', blob: new Blob([target.buffer], { type: 'video/mp4' }), format: 'mp4' };
}

async function encodeWithMediaRecorder(input: EncodeVideoInput): Promise<EncodeVideoOutcome> {
	const size = outputSizeFor(input.aspect, input.resolution);
	const { canvas, scene } = await buildOffscreenScene(size, input.sceneOptions);

	const stream = canvas.captureStream(input.fps);
	const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
	const chunks: Blob[] = [];
	recorder.ondataavailable = (event) => { if (event.data.size > 0) { chunks.push(event.data); } };

	const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
	recorder.start();

	try {
		const frames = frameCount(input.durationS, input.fps);
		const timestamps = frameTimestampsS(frames, input.fps);
		const frameIntervalMs = 1000 / input.fps;

		for (let i = 0; i < timestamps.length; i++) {
			if (input.isCancelled?.()) {
				recorder.stop();
				await done;
				return { outcome: 'cancelled' };
			}

			scene.renderAt(timestamps[i]);
			input.onProgress?.((i + 1) / timestamps.length);
			await sleep(frameIntervalMs);
		}
	} finally {
		recorder.stop();
		await done;
		scene.dispose();
	}

	return { outcome: 'encoded', blob: new Blob(chunks, { type: 'video/webm' }), format: 'webm' };
}

function yieldToMainThread(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function captureCompositionFrame(
	sceneOptions: Omit<CompositionSceneOptions, 'onTextureReady'>,
	aspect: CompositionAspect,
	resolution: ExportResolution,
	t: number
): Promise<Blob> {
	const size = outputSizeFor(aspect, resolution);
	const { canvas, scene } = await buildOffscreenScene(size, sceneOptions);
	try {
		scene.renderAt(t);
		return await new Promise((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (blob) { resolve(blob); } else { reject(new Error('could not export the image')); }
			}, 'image/png');
		});
	} finally {
		scene.dispose();
	}
}
