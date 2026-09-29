export const WAVEFORM_BARS = 64;

const cache = new Map<string, number[]>();

export function peaksOf(samples: Float32Array, bars: number): number[] {
  const count = Math.min(bars, samples.length);
  const size = Math.floor(samples.length / count);
  const peaks: number[] = [];

  for (let bar = 0; bar < count; bar++) {
    let peak = 0;
    for (let i = bar * size; i < (bar + 1) * size; i++) {
      peak = Math.max(peak, Math.abs(samples[i]));
    }
    peaks.push(peak);
  }

  const loudest = Math.max(...peaks);
  return loudest === 0 ? peaks : peaks.map((p) => Math.round((p / loudest) * 100) / 100);
}

export async function waveformOf(key: string, url: string, bars = WAVEFORM_BARS): Promise<number[]> {
  const known = cache.get(key);
  if (known) {
    return known;
  }

  const bytes = await (await fetch(url)).arrayBuffer();
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(bytes);
    const peaks = peaksOf(decoded.getChannelData(0), bars);
    cache.set(key, peaks);
    return peaks;
  } finally {
    void context.close();
  }
}
