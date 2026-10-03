export const PEAKS_PER_SECOND = 20;

export function peaksOf(channels: readonly Float32Array[], buckets: number): number[] {
  const length = channels[0]?.length ?? 0;
  const size = Math.max(1, Math.floor(length / buckets));
  return Array.from({ length: buckets }, (_, b) => {
    let peak = 0;
    for (const channel of channels) {
      for (let i = b * size; i < Math.min(length, (b + 1) * size); i++) {
        peak = Math.max(peak, Math.abs(channel[i]));
      }
    }
    return peak;
  });
}

export function clipPeaks(peaks: readonly number[], clip: { trimStart: number; durationInFrames: number; fps: number }): number[] {
  const start = Math.round((clip.trimStart / clip.fps) * PEAKS_PER_SECOND);
  const count = Math.round((clip.durationInFrames / clip.fps) * PEAKS_PER_SECOND);
  return peaks.slice(start, start + count);
}

export async function loadPeaks(url: string): Promise<number[]> {
  const response = await fetch(url);
  const context = new OfflineAudioContext(1, 1, 44_100);
  const audio = await context.decodeAudioData(await response.arrayBuffer());
  const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
  return peaksOf(channels, Math.max(1, Math.round(audio.duration * PEAKS_PER_SECOND)));
}
