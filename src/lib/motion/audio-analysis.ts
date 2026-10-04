export const ANALYSIS_VERSION = 1;

export type Region = { start: number; end: number };

export type AudioAnalysis = {
  version: number;
  fps: number;
  duration: number;
  amp: number[];
  onsets: number[];
  bpm: number | null;
  beats: number[];
  speech: Region[];
};

const HOP_S = 0.01;
const EPS = 1e-10;
const ONSET_RISE = 1.5;
const ONSET_FLOOR_DB = -40;
const ONSET_GAP_S = 0.1;
const PEAK_RADIUS = 3;
const MIN_BPM = 60;
const MAX_BPM = 200;
const PREFERRED_BPM = 120;
const MIN_ONSETS_FOR_TEMPO = 4;
const SPEECH_FLOOR_DB = -30;
const SPEECH_GAP_S = 0.3;
const SPEECH_MIN_S = 0.15;
const BEAT_DECAY = 0.5;
const ONSET_DECAY_S = 0.25;
const MS = 1000;

const ms = (n: number) => Math.round(n * MS) / MS;
const db = (power: number) => 10 * Math.log10(power + EPS);

function energies(samples: Float32Array, hop: number): number[] {
  const count = Math.ceil(samples.length / hop);
  return Array.from({ length: count }, (_, k) => {
    let sum = 0;
    const end = Math.min(samples.length, (k + 1) * hop);
    for (let i = k * hop; i < end; i++) {
      sum += samples[i] * samples[i];
    }
    return sum / hop;
  });
}

function envelope(samples: Float32Array, rate: number, fps: number): number[] {
  const frames = Math.round((samples.length * fps) / rate);
  const size = rate / fps;
  const rms = Array.from({ length: frames }, (_, f) => {
    let sum = 0;
    const start = Math.round(f * size);
    const end = Math.min(samples.length, Math.round((f + 1) * size));
    for (let i = start; i < end; i++) {
      sum += samples[i] * samples[i];
    }
    return Math.sqrt(sum / Math.max(1, end - start));
  });
  const peak = Math.max(0, ...rms);
  return rms.map((v) => (peak > 0 ? ms(v / peak) : 0));
}

function onsetStrength(energy: number[], peak: number): number[] {
  const floor = peak * 10 ** (ONSET_FLOOR_DB / 10);
  return energy.map((e, k) => {
    const rise = Math.log((e + EPS) / ((energy[k - 1] ?? 0) + EPS));
    return e > floor && rise > ONSET_RISE ? rise : 0;
  });
}

function peaks(strength: number[], hopS: number): number[] {
  const picked: number[] = [];
  for (const [k, s] of strength.entries()) {
    const around = strength.slice(Math.max(0, k - PEAK_RADIUS), k + PEAK_RADIUS + 1);
    const time = k * hopS;
    const last = picked[picked.length - 1];
    if (s <= 0 || s < Math.max(...around) || (last !== undefined && time - last < ONSET_GAP_S)) {
      continue;
    }
    picked.push(time);
  }
  return picked;
}

const near = (strength: number[], at: number) => Math.max(strength[at - 1] ?? 0, strength[at] ?? 0, strength[at + 1] ?? 0);

function tempo(strength: number[], hopS: number): number | null {
  let best: { bpm: number; score: number } | null = null;
  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm++) {
    const lag = Math.round(60 / bpm / hopS);
    let score = 0;
    for (const [k, s] of strength.entries()) {
      score += s > 0 ? s * near(strength, k + lag) : 0;
    }
    const weighted = score * Math.exp(-0.5 * Math.log2(bpm / PREFERRED_BPM) ** 2);
    if (weighted > 0 && (!best || weighted > best.score)) {
      best = { bpm, score: weighted };
    }
  }
  return best?.bpm ?? null;
}

function beatGrid(strength: number[], hopS: number, bpm: number, duration: number): number[] {
  const period = 60 / bpm;
  const steps = Math.round(period / hopS);
  let phase = 0;
  let bestScore = -1;
  for (let p = 0; p < steps; p++) {
    let score = 0;
    for (let t = p * hopS; t < duration; t += period) {
      score += near(strength, Math.round(t / hopS));
    }
    if (score > bestScore) {
      bestScore = score;
      phase = p * hopS;
    }
  }
  const count = Math.ceil((duration - phase) / period);
  return Array.from({ length: count }, (_, i) => ms(phase + i * period)).filter((t) => t < duration);
}

function voiced(energy: number[], peak: number, hopS: number): Region[] {
  const floor = db(peak) + SPEECH_FLOOR_DB;
  const regions: Region[] = [];
  for (const [k, e] of energy.entries()) {
    if (peak <= 0 || db(e) < floor) {
      continue;
    }
    const start = k * hopS;
    const last = regions[regions.length - 1];
    if (last && start - last.end < SPEECH_GAP_S) {
      last.end = start + hopS;
      continue;
    }
    regions.push({ start, end: start + hopS });
  }
  return regions.filter((r) => r.end - r.start >= SPEECH_MIN_S).map((r) => ({ start: ms(r.start), end: ms(r.end) }));
}

export function analyzeAudio(samples: Float32Array, rate: number, fps: number): AudioAnalysis {
  const hop = Math.round(rate * HOP_S);
  const hopS = hop / rate;
  const duration = samples.length / rate;
  const energy = energies(samples, hop);
  const peak = Math.max(0, ...energy);
  const strength = onsetStrength(energy, peak);
  const onsets = peaks(strength, hopS).map(ms);
  const bpm = onsets.length >= MIN_ONSETS_FOR_TEMPO ? tempo(strength, hopS) : null;

  return {
    version: ANALYSIS_VERSION,
    fps,
    duration: ms(duration),
    amp: envelope(samples, rate, fps),
    onsets,
    bpm,
    beats: bpm ? beatGrid(strength, hopS, bpm, duration) : [],
    speech: voiced(energy, peak, hopS)
  };
}

export function ampAt(a: AudioAnalysis, seconds: number, smoothing = 1): number {
  const frame = Math.min(a.amp.length - 1, Math.floor(seconds * a.fps));
  if (frame < 0) {
    return 0;
  }
  const window = a.amp.slice(Math.max(0, frame - Math.max(1, Math.round(smoothing)) + 1), frame + 1);
  return window.reduce((sum, v) => sum + v, 0) / window.length;
}

function lastAtOrBefore(times: number[], seconds: number): number {
  let index = -1;
  for (const [i, t] of times.entries()) {
    if (t > seconds) {
      break;
    }
    index = i;
  }
  return index;
}

export function beatAt(a: AudioAnalysis, seconds: number): number {
  const i = lastAtOrBefore(a.beats, seconds);
  if (i < 0 || !a.bpm) {
    return 0;
  }
  const interval = (a.beats[i + 1] ?? a.beats[i] + 60 / a.bpm) - a.beats[i];
  return Math.max(0, 1 - (seconds - a.beats[i]) / (interval * BEAT_DECAY));
}

export function onsetAt(a: AudioAnalysis, seconds: number): number {
  const i = lastAtOrBefore(a.onsets, seconds);
  return i < 0 ? 0 : Math.max(0, 1 - (seconds - a.onsets[i]) / ONSET_DECAY_S);
}
