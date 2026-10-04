export type Strip = { frames: string[]; seconds: number };

const MAX_SAMPLES = 24;
const FRAME_HEIGHT_PX = 48;
const JPEG_QUALITY = 0.6;

const strips = new Map<string, Promise<Strip>>();
let queue: Promise<unknown> = Promise.resolve();

export function stripSamples(seconds: number): number {
  return Math.min(MAX_SAMPLES, Math.max(1, Math.ceil(seconds)));
}

export function filmstrip(url: string): Promise<Strip> {
  const known = strips.get(url);
  if (known) {
    return known;
  }

  const next = queue.then(() => capture(url));
  queue = next.catch(() => null);
  strips.set(url, next);
  return next;
}

function once(target: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    target.addEventListener(event, () => resolve(), { once: true });
    target.addEventListener('error', () => reject(new Error('video_unreadable')), { once: true });
  });
}

async function capture(url: string): Promise<Strip> {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.preload = 'auto';
  video.src = url;
  await once(video, 'loadedmetadata');

  const seconds = video.duration;
  const count = stripSamples(seconds);
  const canvas = document.createElement('canvas');
  canvas.height = FRAME_HEIGHT_PX;
  canvas.width = Math.round((FRAME_HEIGHT_PX * video.videoWidth) / Math.max(1, video.videoHeight));
  const pen = canvas.getContext('2d')!;

  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    video.currentTime = ((i + 0.5) * seconds) / count;
    await once(video, 'seeked');
    pen.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
  }

  video.removeAttribute('src');
  video.load();
  return { frames, seconds };
}
