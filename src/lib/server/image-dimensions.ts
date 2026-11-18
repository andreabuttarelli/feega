import sharp from 'sharp';

export async function probeImageDimensions(buf: Buffer): Promise<{ width: number | null; height: number | null }> {
  try {
    const meta = await sharp(buf).metadata();
    return { width: meta.width ?? null, height: meta.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}
