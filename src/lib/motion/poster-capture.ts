export const POSTER_WIDTH = 480;
export const POSTER_DEBOUNCE_MS = 2500;
const POSTER_SHARE = 0.4;
const POSTER_QUALITY = 0.8;
const POSTER_MIME = 'image/jpeg';

export function posterSecond(doc: { durationInFrames: number; fps: number }): number {
  return (doc.durationInFrames / doc.fps) * POSTER_SHARE;
}

export function posterJob(shoot: () => Promise<string>, send: (jpeg: string) => Promise<unknown>) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function run() {
    const jpeg = await shoot().catch(() => '');
    if (jpeg) {
      await send(jpeg).catch((e) => console.error('[motion] poster not saved', e));
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

export async function sendPoster(actionUrl: string, jpeg: string, fields: Record<string, string>): Promise<void> {
  const form = new FormData();
  form.set('file', new File([await (await fetch(jpeg)).blob()], 'poster.jpg', { type: POSTER_MIME }));
  Object.entries(fields).forEach(([k, v]) => form.set(k, v));
  await fetch(actionUrl, { method: 'POST', body: form, headers: { 'x-sveltekit-action': 'true' } });
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
      resolve({ jpeg: canvas.toDataURL(POSTER_MIME, POSTER_QUALITY), height: canvas.height });
    };
    video.src = src;
  });
}
