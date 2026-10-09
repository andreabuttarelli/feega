import { Instrument, SAMPLE_RATE, frequencyOf, type ScoreEvent, type ScoreVoice, type SoundScore } from './score';

export type StereoBuffer = { sampleRate: number; left: Float32Array; right: Float32Array };

type Voice = (event: ScoreEvent, voice: ScoreVoice, random: () => number) => Float32Array;

const TAU = Math.PI * 2;
const KNEE = 0.8;
const HEADROOM = 1 - KNEE;

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const samplesOf = (seconds: number) => Math.round(seconds * SAMPLE_RATE);

function bandpass(input: Float32Array, cutoff: (i: number) => number, resonance: number): Float32Array {
  const out = new Float32Array(input.length);
  let low = 0;
  let band = 0;
  for (let i = 0; i < input.length; i++) {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff(i), SAMPLE_RATE / 6)) / SAMPLE_RATE);
    low += f * band;
    const high = input[i] - low - resonance * band;
    band += f * high;
    out[i] = band;
  }
  return out;
}

function noise(length: number, random: () => number): Float32Array {
  return Float32Array.from({ length }, () => random() * 2 - 1);
}

function oscillate(length: number, hz: (t: number) => number, shape: (phase: number) => number = Math.sin): Float32Array {
  const out = new Float32Array(length);
  let phase = 0;
  for (let i = 0; i < length; i++) {
    phase += (TAU * hz(i / SAMPLE_RATE)) / SAMPLE_RATE;
    out[i] = shape(phase);
  }
  return out;
}

const triangle = (phase: number) => (2 / Math.PI) * Math.asin(Math.sin(phase));

function shaped(samples: Float32Array, envelope: (t: number, length: number) => number): Float32Array {
  const seconds = samples.length / SAMPLE_RATE;
  return samples.map((v, i) => v * envelope(i / SAMPLE_RATE, seconds));
}

const attackRelease = (attack: number, release: number) => (t: number, length: number) =>
  Math.min(1, t / Math.max(attack, 1e-4), (length - t) / Math.max(release, 1e-4));

const decay = (rate: number) => (t: number) => Math.exp(-rate * t);

const VOICES: Record<Instrument, Voice> = {
  [Instrument.Whoosh]: (event, voice, random) => {
    const length = samplesOf(event.duration);
    const top = 600 + 5400 * voice.brightness;
    const swept = bandpass(noise(length, random), (i) => 200 + top * Math.sin((Math.PI * i) / length), 0.6);
    return shaped(swept.map((v) => v * 3), (t, l) => Math.sin((Math.PI * Math.min(t + l * 0.06, l)) / l) ** 1.5);
  },
  [Instrument.Hit]: (event, voice, random) => {
    const length = samplesOf(event.duration);
    const base = event.note === undefined ? 55 : frequencyOf(event.note);
    const body = oscillate(length, (t) => base + base * 2.5 * Math.exp(-t * 40));
    const crack = bandpass(noise(length, random), () => 1500 + 3000 * voice.brightness, 1);
    return body.map((v, i) => v * Math.exp((-i / SAMPLE_RATE) * 9) + crack[i] * 1.5 * Math.exp((-i / SAMPLE_RATE) * 60));
  },
  [Instrument.Riser]: (event, voice, random) => {
    const length = samplesOf(event.duration);
    const end = event.duration;
    const base = event.note === undefined ? 220 : frequencyOf(event.note);
    const tone = oscillate(length, (t) => base * 2 ** ((2 * t) / end), triangle);
    const air = bandpass(noise(length, random), (i) => 300 + 6000 * voice.brightness * (i / length) ** 2, 0.5);
    return shaped(tone.map((v, i) => v * 0.5 + air[i] * 2), (t) => (t / end) ** 2.5);
  },
  [Instrument.Click]: (event, voice, random) => {
    const length = Math.min(samplesOf(event.duration), samplesOf(0.06));
    const pitch = event.note === undefined ? 1800 + 2400 * voice.brightness : frequencyOf(event.note);
    const tick = oscillate(length, () => pitch);
    const grain = noise(length, random);
    return tick.map((v, i) => (v * 0.8 + grain[i] * 0.3) * Math.exp((-i / SAMPLE_RATE) * 120));
  },
  [Instrument.Pad]: (event, voice) => {
    const length = samplesOf(event.duration);
    const root = event.note === undefined ? frequencyOf('C3') : frequencyOf(event.note);
    const partials = [1, 1.0035, 1.5, 2, 2.997];
    const stack = partials.map((ratio) => oscillate(length, () => root * ratio, triangle));
    const mixed = Float32Array.from({ length }, (_, i) => stack.reduce((sum, p) => sum + p[i], 0) / partials.length);
    const soft = bandpass(mixed, () => 400 + 2400 * voice.brightness, 1.2);
    return shaped(soft.map((v) => v * 2.5), attackRelease(Math.min(1.2, event.duration / 3), Math.min(1.5, event.duration / 3)));
  },
  [Instrument.Sub]: (event) => {
    const length = samplesOf(event.duration);
    const base = event.note === undefined ? 32 : frequencyOf(event.note);
    const drop = oscillate(length, (t) => base + base * Math.exp(-t * 6));
    return shaped(drop, (t, l) => Math.min(1, t / 0.004) * decay(3 / Math.max(l, 0.1))(t));
  },
  [Instrument.Tone]: (event, voice) => {
    const length = samplesOf(event.duration);
    const hz = event.note === undefined ? frequencyOf('C5') : frequencyOf(event.note);
    const shape = voice.brightness > 0.5 ? triangle : Math.sin;
    return shaped(oscillate(length, () => hz, shape), attackRelease(0.005, Math.min(0.3, event.duration / 2)));
  }
};

const COMBS = [1557, 1617, 1491, 1422];
const ALLPASSES = [225, 556];
const COMB_FEEDBACK = 0.82;
const ALLPASS_GAIN = 0.5;
const STEREO_SPREAD = 23;

function reverb(input: Float32Array, spread: number): Float32Array {
  const out = new Float32Array(input.length);
  for (const size of COMBS.map((c) => c + spread)) {
    const line = new Float32Array(size);
    for (let i = 0; i < input.length; i++) {
      const delayed = line[i % size];
      line[i % size] = input[i] + delayed * COMB_FEEDBACK;
      out[i] += delayed / COMBS.length;
    }
  }
  for (const size of ALLPASSES.map((a) => a + spread)) {
    const line = new Float32Array(size);
    for (let i = 0; i < out.length; i++) {
      const delayed = line[i % size];
      const x = out[i];
      line[i % size] = x + delayed * ALLPASS_GAIN;
      out[i] = delayed - x * ALLPASS_GAIN;
    }
  }
  return out;
}

const limit = (v: number) => (Math.abs(v) <= KNEE ? v : Math.sign(v) * (KNEE + HEADROOM * Math.tanh((Math.abs(v) - KNEE) / HEADROOM)));

function eventSeed(seed: number, index: number): number {
  return (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(index + 1, 0xc2b2ae35)) >>> 0;
}

export function renderScore(score: SoundScore, seconds: number): StereoBuffer {
  const length = samplesOf(seconds);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const wetLeft = new Float32Array(length);
  const wetRight = new Float32Array(length);
  const voices = new Map(score.voices.map((v) => [v.id, v]));

  for (const [index, event] of score.events.entries()) {
    const voice = voices.get(event.voice)!;
    const start = samplesOf(event.at);
    if (start >= length) {
      continue;
    }
    const mono = VOICES[voice.instrument](event, voice, seeded(eventSeed(score.seed, index)));
    const level = voice.gain * event.velocity;
    const toLeft = level * Math.min(1, 1 - voice.pan);
    const toRight = level * Math.min(1, 1 + voice.pan);
    const end = Math.min(length, start + mono.length);
    for (let i = start; i < end; i++) {
      const v = mono[i - start];
      left[i] += v * toLeft * (1 - voice.reverb * 0.5);
      right[i] += v * toRight * (1 - voice.reverb * 0.5);
      wetLeft[i] += v * toLeft * voice.reverb;
      wetRight[i] += v * toRight * voice.reverb;
    }
  }

  const tailLeft = score.voices.some((v) => v.reverb > 0) ? reverb(wetLeft, 0) : wetLeft;
  const tailRight = score.voices.some((v) => v.reverb > 0) ? reverb(wetRight, STEREO_SPREAD) : wetRight;
  return {
    sampleRate: SAMPLE_RATE,
    left: left.map((v, i) => limit(v + tailLeft[i])),
    right: right.map((v, i) => limit(v + tailRight[i]))
  };
}
