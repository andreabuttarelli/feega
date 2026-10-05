import { scheduleEntry } from './audio-graph';
import type { AudioEntry } from './audio-plan';

export type PreviewAudio = {
  play: (entries: AudioEntry[], from: number) => Promise<void>;
  stop: () => void;
};

const MS_PER_S = 1000;

export function previewAudio(): PreviewAudio {
  let context: AudioContext | null = null;
  let sources: AudioBufferSourceNode[] = [];
  let generation = 0;
  const buffers = new Map<string, Promise<AudioBuffer>>();

  const decode = (ctx: AudioContext, url: string) => {
    const cached = buffers.get(url);
    if (cached) {
      return cached;
    }
    const loading = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((bytes) => ctx.decodeAudioData(bytes));
    loading.catch(() => buffers.delete(url));
    buffers.set(url, loading);
    return loading;
  };

  function stop() {
    generation += 1;
    for (const source of sources) {
      source.stop();
    }
    sources = [];
  }

  async function play(entries: AudioEntry[], from: number) {
    stop();
    const mine = generation;
    const asked = performance.now();
    context ??= new AudioContext();
    const ctx = context;
    await ctx.resume();
    const decoded = await Promise.allSettled(entries.map((e) => decode(ctx, e.url)));
    if (mine !== generation) {
      return;
    }

    const clock = {
      origin: ctx.currentTime,
      from: from + (performance.now() - asked) / MS_PER_S
    };
    sources = entries.flatMap((entry, i) => {
      const result = decoded[i];
      const source = result.status === 'fulfilled' ? scheduleEntry(ctx, result.value, entry, clock, ctx.destination) : null;
      return source ? [source] : [];
    });
  }

  return { play, stop };
}
