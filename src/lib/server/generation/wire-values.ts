const MIME_OF_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  glb: 'model/gltf-binary'
};

const FALLBACK_MIME = 'application/octet-stream';

export function mimeOfOutputUrl(url: string): string {
  const extension = new URL(url).pathname.split('.').pop()?.toLowerCase() ?? '';
  return MIME_OF_EXTENSION[extension] ?? FALLBACK_MIME;
}

export function numericKeysOf(ref: Readonly<Record<string, unknown>>): string[] {
  return Array.isArray(ref.numeric) ? ref.numeric.map(String) : [];
}

export function withNumbers(inputs: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, keys.includes(key) && value !== '' ? Number(value) : value]));
}
