import { MIC_PROBLEM_MESSAGE, micProblemOf } from './voice-recording';
import { RECORD_MAX_SECONDS, cropOf, recordingFileName, videoMime, type Area } from './screen-recording';

const FRAME_RATE = 30;
const MS_PER_SECOND = 1000;
const TICK_MS = 250;
const BACKDROP = '#f5f6f8';

export enum MicMode {
  Off = 'off',
  On = 'on'
}

export type RecordingRun = { stop: () => void; done: Promise<File> };

type Start = { source: HTMLCanvasElement; area: Area; mic: MicMode; onTick: (seconds: number) => void };

async function micTracks(mic: MicMode): Promise<MediaStreamTrack[]> {
  if (mic === MicMode.Off) {
    return [];
  }
  try {
    return (await navigator.mediaDevices.getUserMedia({ audio: true })).getAudioTracks();
  } catch (error) {
    throw new Error(MIC_PROBLEM_MESSAGE[micProblemOf(error as { name?: string })]);
  }
}

export async function startRecording({ source, area, mic, onTick }: Start): Promise<RecordingRun> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('This browser cannot record video.');
  }

  const ratio = source.width / Math.max(source.clientWidth, 1);
  const crop = cropOf(area, { width: source.width, height: source.height }, ratio);
  const frame = Object.assign(document.createElement('canvas'), { width: crop.sw, height: crop.sh });
  const ctx = frame.getContext('2d')!;
  const audio = await micTracks(mic);
  const stream = frame.captureStream(FRAME_RATE);
  audio.forEach((track) => stream.addTrack(track));

  const mime = videoMime((m) => MediaRecorder.isTypeSupported(m));
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => chunks.push(event.data);

  const feed: HTMLVideoElement = document.createElement('video');
  feed.srcObject = source.captureStream(FRAME_RATE);
  feed.muted = true;
  await feed.play();

  let raf = 0;
  const paint = () => {
    ctx.fillStyle = BACKDROP;
    ctx.fillRect(0, 0, crop.sw, crop.sh);
    ctx.drawImage(feed, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);
    raf = requestAnimationFrame(paint);
  };
  paint();

  const startedAt = performance.now();
  const seconds = () => (performance.now() - startedAt) / MS_PER_SECOND;
  const ticker = setInterval(() => onTick(Math.min(seconds(), RECORD_MAX_SECONDS)), TICK_MS);
  const limit = setTimeout(() => stop(), RECORD_MAX_SECONDS * MS_PER_SECOND);

  const done = new Promise<File>((resolve) => {
    recorder.onstop = () => {
      cancelAnimationFrame(raf);
      feed.srcObject = null;
      clearInterval(ticker);
      clearTimeout(limit);
      audio.forEach((track) => track.stop());
      const type = recorder.mimeType || mime || 'video/webm';
      resolve(new File(chunks, recordingFileName(new Date(), type), { type: type.split(';')[0] }));
    };
  });

  function stop() {
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
  }

  recorder.start();
  return { stop, done };
}
