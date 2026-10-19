import { postPageAction } from '$lib/api/page-action';
import { Background } from './doc';
import { FrameFormat } from './hyperframes/capture';
export const POSTER_WIDTH = 480;
export const POSTER_DEBOUNCE_MS = 2500;
const POSTER_SHARE = 0.4;
const POSTER_QUALITY = 0.8;
const POSTER_FORMAT: Record<Background, FrameFormat> = { [Background.Brand]: FrameFormat.Jpeg, [Background.Transparent]: FrameFormat.Png };

export const posterFormat = (background: Background | undefined): FrameFormat => POSTER_FORMAT[background ?? Background.Brand];

const JPEG_MIME = 'image/jpeg';
const DATA_URL_MIME = /^data:([^;,]+)/;
const POSTER_FILE: Record<string, string> = { [JPEG_MIME]: 'poster.jpg', 'image/png': 'poster.png' };

export function posterSecond(doc: { durationInFrames: number; fps: number }): number {
  return (doc.durationInFrames / doc.fps) * POSTER_SHARE;
}

export function posterJob(shoot: () => Promise<string>, send: (jpeg: string, revision?: number) => Promise<unknown>, revision: () => number | undefined = () => undefined) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function run() {
    const shotAt = revision();
    const jpeg = await shoot().catch(() => '');
    if (jpeg) {
      await send(jpeg, shotAt).catch((e) => console.error('[motion] poster not saved', e));
    }
  }

  return {
    schedule() {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => void run(), POSTER_DEBOUNCE_MS);
    }
  };
}

export async function sendPoster(pageUrl: string, jpeg: string, fields: Record<string, string>): Promise<void> {
  const form = new FormData();
  const mime = DATA_URL_MIME.exec(jpeg)?.[1] ?? JPEG_MIME;
  form.set('file', new File([await (await fetch(jpeg)).blob()], POSTER_FILE[mime] ?? 'poster.jpg', { type: mime }));
  Object.entries(fields).forEach(([k, v]) => form.set(k, v));
  await postPageAction(pageUrl, 'poster', form);
}

export function videoPoster(src: string, width: number): Promise<{ jpeg: string; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    video.onerror = () => reject(new Error('video not readable'));
    video.onloadedmetadata = () => {
      video.currentTime = video.duration * POSTER_SHARE;
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round((width * video.videoHeight) / video.videoWidth);
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve({ jpeg: canvas.toDataURL(JPEG_MIME, POSTER_QUALITY), height: canvas.height });
    };
    video.src = src;
  });
}
