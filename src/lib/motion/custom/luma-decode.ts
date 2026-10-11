import { lumaOf } from '../smoothness';
import type { Luma } from './determinism';

export async function decodeLuma(url: string): Promise<Luma> {
  if (!url) {
    return { width: 0, values: new Uint8Array(0) };
  }
  const img = new Image();
  img.src = url;
  await img.decode();
  const pen = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight }).getContext('2d', { willReadFrequently: true });
  if (!pen) {
    throw new Error('no 2d canvas to read the frame');
  }
  pen.drawImage(img, 0, 0);
  return { width: img.naturalWidth, values: lumaOf(pen.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data) };
}
