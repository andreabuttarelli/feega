const CACHE = 'gpu-canvas-snapshots-v1';
const PREFIX = '/__gpu-snapshot/';
const LATEST = '/__gpu-snapshot-latest/';
const KEY_HEADER = 'x-snapshot-key';

export async function digest(key: string): Promise<string> {
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

export async function latestSnapshot(nodeId: string): Promise<{ key: string; bitmap: ImageBitmap } | null> {
  try {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(LATEST + nodeId);
    if (!hit) {
      return null;
    }
    const key = decodeURIComponent(hit.headers.get(KEY_HEADER) ?? '');
    return { key, bitmap: await createImageBitmap(await hit.blob()) };
  } catch {
    return null;
  }
}

export async function storeSnapshot(nodeId: string, key: string, canvas: HTMLCanvasElement): Promise<Blob | null> {
  try {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.92));
    if (!blob) {
      return null;
    }
    const cache = await caches.open(CACHE);
    const headers = { 'content-type': 'image/webp', [KEY_HEADER]: encodeURIComponent(key) };
    await cache.put(PREFIX + (await digest(key)), new Response(blob, { headers }));
    await cache.put(LATEST + nodeId, new Response(blob, { headers }));
    return blob;
  } catch {
    return null;
  }
}

export async function remoteSnapshot(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url);
    return res.ok ? await createImageBitmap(await res.blob()) : null;
  } catch {
    return null;
  }
}

export async function uploadSnapshot(endpoint: string, nodeId: string, key: string, blob: Blob): Promise<void> {
  const form = new FormData();
  form.set('nodeId', nodeId);
  form.set('hash', await digest(key));
  form.set('file', new File([blob], 'card.webp', { type: 'image/webp' }));
  await fetch(endpoint, { method: 'POST', body: form }).catch(() => undefined);
}
