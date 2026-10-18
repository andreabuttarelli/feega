const CACHE = 'gpu-canvas-snapshots-v1';
const PREFIX = '/__gpu-snapshot/';

async function digest(key: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function cachedSnapshot(key: string): Promise<ImageBitmap | null> {
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(PREFIX + (await digest(key)));
    return hit ? await createImageBitmap(await hit.blob()) : null;
  } catch {
    return null;
  }
}

export async function storeSnapshot(key: string, canvas: HTMLCanvasElement): Promise<void> {
  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.92));
    if (!blob) {
      return;
    }
    const cache = await caches.open(CACHE);
    await cache.put(PREFIX + (await digest(key)), new Response(blob, { headers: { 'content-type': 'image/webp' } }));
  } catch {
    return;
  }
}
