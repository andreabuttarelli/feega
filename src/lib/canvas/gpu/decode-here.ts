export async function decodeHere(url: string, edge: number): Promise<ImageBitmap> {
  const res = await fetch(url, { credentials: 'same-origin', mode: 'cors' });
  if (!res.ok) {
    throw new Error(`${res.status} ${url}`);
  }
  const full = await createImageBitmap(await res.blob());
  const scale = Math.min(1, edge / Math.max(full.width, full.height));
  if (scale === 1) {
    return full;
  }
  const fitted = await createImageBitmap(full, { resizeWidth: Math.round(full.width * scale), resizeHeight: Math.round(full.height * scale), resizeQuality: 'high' });
  full.close();
  return fitted;
}
