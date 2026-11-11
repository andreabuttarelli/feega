import { premultiply, TILE_SIDE_PX, unpremultiply } from './tile-cache';

export const TILE_TYPE = 'image/webp';
const TILE_QUALITY = 0.9;

export type CodecAsk = { id: number; encode: Uint8Array; type: string } | { id: number; decode: Blob };
export type CodecAnswer = { id: number; blob?: Blob; pixels?: Uint8Array; ms: number; error?: string };

export async function encodeTile(pixels: Uint8Array, type: string): Promise<Blob> {
  const straight = unpremultiply(pixels);
  const canvas = new OffscreenCanvas(TILE_SIDE_PX, TILE_SIDE_PX);
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(straight.buffer as ArrayBuffer, straight.byteOffset, straight.byteLength), TILE_SIDE_PX, TILE_SIDE_PX), 0, 0);
  return canvas.convertToBlob({ type, quality: TILE_QUALITY });
}

export async function decodeTile(blob: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const canvas = new OffscreenCanvas(TILE_SIDE_PX, TILE_SIDE_PX);
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const data = context.getImageData(0, 0, TILE_SIDE_PX, TILE_SIDE_PX).data;
  return premultiply(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
}

export type TileCodec = { encode: (pixels: Uint8Array, type?: string) => Promise<{ blob: Blob; ms: number }>; decode: (blob: Blob) => Promise<Uint8Array> };

export function tileCodec(spawn: () => Worker | null): TileCodec {
  let worker: Worker | null = null;
  let next = 0;
  const waiting = new Map<number, (answer: CodecAnswer) => void>();
  const ask = (message: CodecAsk, transfer: Transferable[]) =>
    new Promise<CodecAnswer>((resolve, reject) => {
      worker ??= spawn();
      if (!worker) {
        reject(new Error('no worker'));
        return;
      }
      worker.onmessage = (e: MessageEvent<CodecAnswer>) => {
        waiting.get(e.data.id)?.(e.data);
        waiting.delete(e.data.id);
      };
      waiting.set(message.id, (answer) => (answer.error ? reject(new Error(answer.error)) : resolve(answer)));
      worker.postMessage(message, transfer);
    });
  return {
    encode: async (pixels, type = TILE_TYPE) => {
      const answer = await ask({ id: next++, encode: pixels, type }, [pixels.buffer]);
      return { blob: answer.blob!, ms: answer.ms };
    },
    decode: async (blob) => (await ask({ id: next++, decode: blob }, [])).pixels!
  };
}
