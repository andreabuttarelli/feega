import { lumaOf } from '../smoothness';

export async function decodeLuma(url: string): Promise<Uint8Array> {
  if (!url) {
    return new Uint8Array(0);
  }
  const img = new Image();
  img.src = url;
  await img.decode();
  const pen = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight }).getContext('2d', { willReadFrequently: true });
  if (!pen) {
    throw new Error('no 2d canvas to read the frame');
  }
  pen.drawImage(img, 0, 0);
  return lumaOf(pen.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data);
}
