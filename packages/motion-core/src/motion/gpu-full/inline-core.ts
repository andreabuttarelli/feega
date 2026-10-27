export const INLINE_CORE_GLOBAL = '__feegaGpuCore';

export type InlineFonts = { text: Record<string, string>; bytes: Record<string, string> };

export type InlineCore = { js: string; wasm: string; origin: string; fonts?: InlineFonts };

const BASE64_CHUNK = 0x8000;

export const inlineCore = (): InlineCore | null => (globalThis as unknown as Record<string, InlineCore | undefined>)[INLINE_CORE_GLOBAL] ?? null;

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

export function base64Of(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
  }
  return btoa(binary);
}

export const bytesOfBase64 = (encoded: string): Uint8Array => Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));

export async function zipBase64(bytes: Uint8Array): Promise<string> {
  return base64Of(await through(bytes, new CompressionStream('gzip')));
}

export const unzipBase64 = async (encoded: string): Promise<Uint8Array> => through(bytesOfBase64(encoded), new DecompressionStream('gzip'));
