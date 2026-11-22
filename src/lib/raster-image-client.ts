import {
	RASTER_JPEG_MAX_EDGE,
	RASTER_SOURCE_MAX_BYTES,
	isHeicSource,
	jpegFilename,
	sniffHeifBrand
} from '$lib/raster-image';

function jpegFileFromBlob(blob: Blob, name: string): File {
	return new File([blob], jpegFilename(name), { type: 'image/jpeg' });
}

async function canvasJpeg(
	bitmap: ImageBitmap,
	width: number,
	height: number,
	quality: number
): Promise<Blob | null> {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.drawImage(bitmap, 0, 0, width, height);
	return withStallTimeout(
		new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)),
		'canvas.toBlob'
	);
}

async function bitmapToJpegBlob(
	bitmap: ImageBitmap,
	opts: { maxEdge: number; maxBytes: number; quality?: number }
): Promise<Blob | null> {
	const fit = (edge: number) => {
		const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height, 1));
		return {
			w: Math.max(1, Math.round(bitmap.width * scale)),
			h: Math.max(1, Math.round(bitmap.height * scale))
		};
	};
	let { w, h } = fit(opts.maxEdge);
	const qualities = opts.quality != null ? [opts.quality] : [0.86, 0.78, 0.7, 0.6, 0.5];
	for (const q of qualities) {
		const blob = await canvasJpeg(bitmap, w, h, q);
		if (blob && blob.size <= opts.maxBytes) return blob;
	}
	({ w, h } = fit(Math.min(1280, opts.maxEdge)));
	const blob = await canvasJpeg(bitmap, w, h, 0.68);
	if (blob && blob.size <= opts.maxBytes) return blob;
	return null;
}

async function convertHeicOnServer(file: File): Promise<Blob> {
	const fd = new FormData();
	fd.set('file', file);
	const res = await fetch('/app/raster/jpeg', { method: 'POST', body: fd });
	if (!res.ok) throw new Error('heic_convert_failed');
	return res.blob();
}

export async function fileLooksLikeHeic(file: File): Promise<boolean> {
	if (isHeicSource({ mime: file.type, filename: file.name })) return true;
	const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
	return sniffHeifBrand(head) === 'heic';
}

/**
 * I browser API di decode/encode (createImageBitmap, canvas.toBlob, FileReader) sono promesse
 * resolve-only: se il callback non arriva mai, la catena resta appesa e l'allegato sparisce in
 * silenzio — nessun errore, nessuna strip, e il turno parte cieco. Il tetto di stall trasforma
 * ogni appendersi in un rifiuto che la UI mostra.
 */
export const CONVERT_STALL_TIMEOUT_MS = 15_000;

export function withStallTimeout<T>(p: Promise<T>, what: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`convert_stalled: ${what}`)), CONVERT_STALL_TIMEOUT_MS);
		p.then(
			(v) => { clearTimeout(timer); resolve(v); },
			(e) => { clearTimeout(timer); reject(e); }
		);
	});
}

/**
 * Convert HEIC/HEIF to JPEG. Other rasters (PNG with transparency, JPEG, WebP, GIF) pass through.
 * Safari/iOS decodes HEIC natively; Chrome falls back to the server decoder.
 */
export async function jpegIfHeicFile(file: File): Promise<File> {
	if (file.type.startsWith('video/')) return file;
	if (!file.size) return file;
	if (!(await fileLooksLikeHeic(file))) return file;
	if (file.size > RASTER_SOURCE_MAX_BYTES) throw new Error('too_large');

	try {
		const bitmap = await createImageBitmap(file);
		try {
			const blob = await bitmapToJpegBlob(bitmap, {
				maxEdge: RASTER_JPEG_MAX_EDGE,
				maxBytes: 12 * 1024 * 1024
			});
			if (!blob) throw new Error('too_large');
			return jpegFileFromBlob(blob, file.name);
		} finally {
			bitmap.close();
		}
	} catch {
		const blob = await convertHeicOnServer(file);
		return jpegFileFromBlob(blob, file.name);
	}
}

/** Replace HEIC files on a FormData field; PNG/JPEG/WebP/GIF stay as-is. */
export async function jpegIfHeicFormFiles(formData: FormData, field: string): Promise<void> {
	const files = formData.getAll(field).filter((f): f is File => f instanceof File && f.size > 0);
	if (!files.length) return;
	formData.delete(field);
	for (const file of files) {
		try {
			formData.append(field, await jpegIfHeicFile(file));
		} catch {
			formData.append(field, file);
		}
	}
}
