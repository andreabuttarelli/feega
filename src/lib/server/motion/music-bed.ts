export const SAMPLE_RATE = 44_100;
export const MUSIC_BED_LICENSE = 'CC0 1.0 Universal: a music bed synthesised by feega from code, no samples, no third-party rights';

const HEADER_BYTES = 44;
const PCM_MAX = 32_767;
const BASS_ROOTS = [55, 43.65, 65.41, 49];
const PAD_CHORDS = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [261.63, 329.63, 392],
  [196, 246.94, 293.66]
];
const PEAK_SHARE = 2 / 3;
const NOISE_SEED = 0x2545f491;

type Bed = { seconds: number; bpm: number };

function noise(seed: number): () => number {
  let state = seed;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff) * 2 - 1;
  };
}

function wavOf(samples: Float32Array): Buffer {
  const out = Buffer.alloc(HEADER_BYTES + samples.length * 2);
  out.write('RIFF', 0, 'latin1');
  out.writeUInt32LE(36 + samples.length * 2, 4);
  out.write('WAVE', 8, 'latin1');
  out.write('fmt ', 12, 'latin1');
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SAMPLE_RATE, 24);
  out.writeUInt32LE(SAMPLE_RATE * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36, 'latin1');
  out.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * PCM_MAX), HEADER_BYTES + i * 2));
  return out;
}

export function musicBed(bed: Bed): Buffer {
  const total = Math.round(bed.seconds * SAMPLE_RATE);
  const beat = 60 / bed.bpm;
  const bar = beat * 4;
  const peak = bed.seconds * PEAK_SHARE;
  const hiss = noise(NOISE_SEED);
  const out = new Float32Array(total);

  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    const inBeat = t % beat;
    const inHalf = t % (beat / 2);
    const beatIndex = Math.floor(t / beat);
    const chord = Math.floor(t / bar) % PAD_CHORDS.length;
    const build = Math.min(1, t / peak);
    const drop = t >= peak ? 1 : 0;

    const kick = Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-inBeat * 30)) * inBeat) * Math.exp(-inBeat * 9);
    const snare = beatIndex % 2 === 1 ? hiss() * Math.exp(-inBeat * 22) * 0.5 : 0;
    const hat = hiss() * Math.exp(-inHalf * 90) * (0.12 + 0.12 * build);
    const bass = Math.sin(2 * Math.PI * BASS_ROOTS[chord] * t) * Math.exp(-inHalf * 4) * 0.35;
    const pad = PAD_CHORDS[chord].reduce((sum, f) => sum + Math.sin(2 * Math.PI * f * t), 0) * (0.03 + 0.05 * build + 0.04 * drop);
    const riser = t < peak && t > peak - bar ? hiss() * ((t - (peak - bar)) / bar) * 0.25 : 0;

    out[i] = (kick * (0.55 + 0.25 * drop) + snare * (0.4 + 0.5 * build) + hat + bass * (0.5 + 0.5 * build) + pad + riser) * 0.7;
  }
  return wavOf(out);
}
