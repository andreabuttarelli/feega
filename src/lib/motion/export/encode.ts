import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import { gainCurve, type AudioEntry } from '../audio-plan';
import { exportSize, type Capabilities, type Size } from '../export-plan';
import { Resolution } from '../render-quote';
import type { MotionDoc } from '../doc';

export const MP4_MIME = 'video/mp4';
const SAMPLE_RATE = 48_000;
const CHANNELS = 2;
const AUDIO_BITRATE = 192_000;
const KEYFRAME_SECONDS = 2;

export type FrameRenderer = (onFrame: (bitmap: ImageBitmap, index: number) => Promise<void>) => Promise<void>;

export type EncodeJob = { size: Size; fps: number; frames: number; samples: number; render: FrameRenderer; audio: AudioBuffer | null; onFrame: (done: number) => void; signal: AbortSignal };

export async function capabilities(doc: Pick<MotionDoc, 'width' | 'height'>): Promise<Capabilities> {
  if (typeof VideoEncoder === 'undefined') {
    return { webCodecs: false, h264: false, h264At720: false, aac: false };
  }
  const [h264, h264At720, aac] = await Promise.all([
    canEncodeVideo('avc', { ...exportSize(doc, Resolution.P1080), bitrate: QUALITY_HIGH }),
    canEncodeVideo('avc', { ...exportSize(doc, Resolution.P720), bitrate: QUALITY_HIGH }),
    canEncodeAudio('aac', { numberOfChannels: CHANNELS, sampleRate: SAMPLE_RATE, bitrate: AUDIO_BITRATE })
  ]);
  return { webCodecs: true, h264, h264At720, aac };
}

async function decoded(context: OfflineAudioContext, url: string): Promise<AudioBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`an audio file did not load (${response.status})`);
  }
  return context.decodeAudioData(await response.arrayBuffer());
}

export async function mixAudio(entries: AudioEntry[], seconds: number): Promise<AudioBuffer | null> {
  if (!entries.length) {
    return null;
  }
  const context = new OfflineAudioContext(CHANNELS, Math.ceil(seconds * SAMPLE_RATE), SAMPLE_RATE);
  const buffers = await Promise.all(entries.map((e) => decoded(context, e.url)));

  for (const [i, entry] of entries.entries()) {
    const source = context.createBufferSource();
    source.buffer = buffers[i];
    const gain = context.createGain();
    const [first, ...rest] = gainCurve(entry);
    gain.gain.setValueAtTime(first.value, first.time);
    for (const point of rest) {
      gain.gain.linearRampToValueAtTime(point.value, point.time);
    }
    source.connect(gain).connect(context.destination);
    source.start(entry.at, entry.offset, entry.duration);
  }
  return context.startRendering();
}

export async function encodeMp4(job: EncodeJob): Promise<Blob> {
  const canvas = new OffscreenCanvas(job.size.width, job.size.height);
  const paint = canvas.getContext('2d');
  if (!paint) {
    throw new Error('no 2D canvas');
  }

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const video = new CanvasSource(canvas, { codec: 'avc', bitrate: QUALITY_HIGH, keyFrameInterval: KEYFRAME_SECONDS });
  output.addVideoTrack(video, { frameRate: job.fps });
  const audio = job.audio ? new AudioBufferSource({ codec: 'aac', bitrate: AUDIO_BITRATE }) : null;
  if (audio) {
    output.addAudioTrack(audio);
  }

  const abort = () => void output.cancel();
  job.signal.addEventListener('abort', abort, { once: true });
  try {
    await output.start();
    if (audio && job.audio) {
      await audio.add(job.audio);
      audio.close();
    }
    await job.render(async (bitmap, sample) => {
      const frame = Math.floor(sample / job.samples);
      const k = sample % job.samples;
      if (k === 0) {
        paint.clearRect(0, 0, job.size.width, job.size.height);
      }
      paint.globalAlpha = 1 / (k + 1);
      paint.drawImage(bitmap, 0, 0, job.size.width, job.size.height);
      bitmap.close();
      if (k < job.samples - 1) {
        return;
      }
      await video.add(frame / job.fps, 1 / job.fps);
      job.onFrame(frame + 1);
    });
    job.signal.throwIfAborted();
    await output.finalize();
  } finally {
    job.signal.removeEventListener('abort', abort);
  }

  if (!target.buffer) {
    throw new Error('the encoder produced no file');
  }
  return new Blob([target.buffer], { type: MP4_MIME });
}
