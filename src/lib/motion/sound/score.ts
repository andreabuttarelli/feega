import { z } from 'zod';
import { MAX_SECONDS } from '../design';

export enum Instrument {
  Whoosh = 'whoosh',
  Hit = 'hit',
  Riser = 'riser',
  Click = 'click',
  Pad = 'pad',
  Sub = 'sub',
  Tone = 'tone'
}

export const INSTRUMENTS = Object.values(Instrument) as [Instrument, ...Instrument[]];

export const SAMPLE_RATE = 48_000;
export const MAX_VOICES = 16;
export const MAX_EVENTS = 400;
export const MAX_EVENT_SECONDS = 12;
export const MAX_SOUNDING_SECONDS = 600;

const NOTE = /^([A-G])(#|b)?(-?\d)$/;

export const voiceSchema = z.object({
  id: z.string().min(1).max(40),
  instrument: z.enum(INSTRUMENTS),
  gain: z.number().min(0).max(1).default(0.6),
  pan: z.number().min(-1).max(1).default(0),
  reverb: z.number().min(0).max(1).default(0),
  brightness: z.number().min(0).max(1).default(0.5)
});

export const eventSchema = z.object({
  voice: z.string().min(1).max(40),
  at: z.number().min(0).max(MAX_SECONDS),
  duration: z.number().positive().max(MAX_EVENT_SECONDS),
  note: z.union([z.string().regex(NOTE, 'a note like C3, F#4 or Bb2'), z.number().min(20).max(12_000)]).optional(),
  velocity: z.number().min(0).max(1).default(0.8)
});

export const soundScoreSchema = z
  .object({
    seed: z.number().int().min(0).max(2 ** 31).default(1),
    bpm: z.number().min(40).max(220).optional(),
    voices: z.array(voiceSchema).min(1).max(MAX_VOICES),
    events: z.array(eventSchema).max(MAX_EVENTS)
  })
  .refine((s) => new Set(s.voices.map((v) => v.id)).size === s.voices.length, 'voice ids are unique')
  .refine((s) => s.events.every((e) => s.voices.some((v) => v.id === e.voice)), 'every event plays a declared voice')
  .refine((s) => s.events.reduce((sum, e) => sum + e.duration, 0) <= MAX_SOUNDING_SECONDS, `at most ${MAX_SOUNDING_SECONDS} s of sounding events in total`);

export type SoundScore = z.infer<typeof soundScoreSchema>;
export type ScoreVoice = SoundScore['voices'][number];
export type ScoreEvent = SoundScore['events'][number];

const SEMITONES: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
const ACCIDENTAL: Record<string, number> = { '#': 1, b: -1, '': 0 };
const A4 = 440;

export function frequencyOf(note: string | number): number {
  if (typeof note === 'number') {
    return note;
  }
  const [, letter, accidental = '', octave] = NOTE.exec(note) ?? [];
  const steps = SEMITONES[letter] + ACCIDENTAL[accidental] + (Number(octave) - 4) * 12;
  return A4 * 2 ** (steps / 12);
}
