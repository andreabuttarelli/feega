import { safeFetchBytes, SafeFetchError } from '$lib/server/tool-guard';
import { IMAGE_PART_MAX_BYTES, IMAGE_PART_MAX_EDGE, RASTER_SOURCE_MAX_BYTES } from '$lib/raster-image';
import type { RasterJpegError } from '$lib/server/raster-image';

export type ImagePart = { inlineData: { mimeType: string; data: string } };

export type ImagePartRefusal = 'too_large' | 'not_an_image' | 'fetch_failed';

export type ImagePartOutcome =
  | { ok: true; part: ImagePart }
  | { ok: false; reason: ImagePartRefusal };

const REFUSAL_BY_CONVERSION: Record<RasterJpegError, ImagePartRefusal> = {
  not_image: 'not_an_image',
  convert_failed: 'not_an_image',
  too_large: 'too_large'
};

function inlinePart(mimeType: string, bytes: Buffer): ImagePart {
  return { inlineData: { mimeType, data: bytes.toString('base64') } };
}

export async function imagePartFor(url: string): Promise<ImagePartOutcome> {
  let fetched;
  try {
    fetched = await safeFetchBytes(url, { maxBytes: RASTER_SOURCE_MAX_BYTES });
  } catch (e) {
    const tooLarge = e instanceof SafeFetchError && e.reason === 'too_large';
    return { ok: false, reason: tooLarge ? 'too_large' : 'fetch_failed' };
  }
  if (!fetched.ok) {
    return { ok: false, reason: 'fetch_failed' };
  }

  const mimeType = fetched.mime || 'image/jpeg';
  if (!mimeType.startsWith('image/')) {
    return { ok: false, reason: 'not_an_image' };
  }
  if (fetched.bytes.length <= IMAGE_PART_MAX_BYTES) {
    return { ok: true, part: inlinePart(mimeType, fetched.bytes) };
  }

  const { rasterToJpeg } = await import('$lib/server/raster-image');
  const shrunk = await rasterToJpeg(fetched.bytes, {
    always: true,
    mime: mimeType,
    maxBytes: IMAGE_PART_MAX_BYTES,
    maxEdge: IMAGE_PART_MAX_EDGE
  });
  if (!shrunk.ok) {
    return { ok: false, reason: REFUSAL_BY_CONVERSION[shrunk.error] };
  }

  return { ok: true, part: inlinePart('image/jpeg', shrunk.bytes) };
}

export async function fetchImagePart(url: string): Promise<ImagePart | null> {
  const outcome = await imagePartFor(url);

  return outcome.ok ? outcome.part : null;
}
