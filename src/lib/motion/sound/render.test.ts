import { describe, expect, it } from 'vitest';
import { Instrument, SAMPLE_RATE, soundScoreSchema, type SoundScore } from './score';
import { renderScore } from './render';
import { decodeWav, encodeWav } from './wav';

const FPS = 30;
const ONSET = 0.02;

const score = (events: SoundScore['events'], voices: SoundScore['voices'] = [{ id: 'fx', instrument: Instrument.Hit }]): SoundScore =>
  soundScoreSchema.parse({ seed: 7, voices, events });

function onsetFrame(channel: Float32Array): number {
  const sample = channel.findIndex((v) => Math.abs(v) > ONSET);
  return Math.floor((sample / SAMPLE_RATE) * FPS);
}

describe('sound score render', () => {
  it('renders the same samples twice', () => {
    const s = score(
      [
        { voice: 'w', at: 0.5, duration: 0.8 },
        { voice: 'fx', at: 1.2, duration: 0.4 }
      ],
      [
        { id: 'w', instrument: Instrument.Whoosh, reverb: 0.4 },
        { id: 'fx', instrument: Instrument.Hit }
      ]
    );
    const a = renderScore(s, 3);
    const b = renderScore(s, 3);

    expect(a.left).toEqual(b.left);
    expect(a.right).toEqual(b.right);
    expect(a.left.some((v) => v !== 0)).toBe(true);
  });

  it('a different seed changes the noise', () => {
    const voices = [{ id: 'w', instrument: Instrument.Whoosh }];
    const events = [{ voice: 'w', at: 0, duration: 1 }];
    const a = renderScore(soundScoreSchema.parse({ seed: 1, voices, events }), 1);
    const b = renderScore(soundScoreSchema.parse({ seed: 2, voices, events }), 1);

    expect(a.left).not.toEqual(b.left);
  });

  it('lasts exactly the asked duration', () => {
    const out = renderScore(score([{ voice: 'fx', at: 2.9, duration: 2 }]), 3.25);

    expect(out.left.length).toBe(Math.round(3.25 * SAMPLE_RATE));
    expect(out.right.length).toBe(out.left.length);
  });

  it.each([Instrument.Hit, Instrument.Click, Instrument.Sub, Instrument.Whoosh])('a %s lands on its frame', (instrument) => {
    const at = 1.5;
    const out = renderScore(score([{ voice: 'v', at, duration: 0.5 }], [{ id: 'v', instrument }]), 3);

    expect(Math.abs(onsetFrame(out.left) - at * FPS)).toBeLessThanOrEqual(1);
  });

  it('a riser peaks where it ends, on the reveal', () => {
    const out = renderScore(score([{ voice: 'r', at: 1, duration: 1 }], [{ id: 'r', instrument: Instrument.Riser }]), 3);
    const loudest = out.left.reduce((best, v, i) => (Math.abs(v) > Math.abs(out.left[best]) ? i : best), 0);

    expect(Math.abs(Math.floor((loudest / SAMPLE_RATE) * FPS) - 2 * FPS)).toBeLessThanOrEqual(2);
  });

  it('never clips', () => {
    const events = Array.from({ length: 20 }, () => ({ voice: 'fx', at: 0.5, duration: 0.5, velocity: 1 }));
    const out = renderScore(score(events, [{ id: 'fx', instrument: Instrument.Hit, gain: 1 }]), 1);

    expect(Math.max(...out.left.map(Math.abs))).toBeLessThanOrEqual(1);
  });

  it('pans a voice to one side', () => {
    const out = renderScore(score([{ voice: 'fx', at: 0, duration: 0.3 }], [{ id: 'fx', instrument: Instrument.Click, pan: -1 }]), 0.5);

    expect(out.right.every((v) => v === 0)).toBe(true);
    expect(out.left.some((v) => v !== 0)).toBe(true);
  });

  it('ignores events past the end', () => {
    const out = renderScore(score([{ voice: 'fx', at: 5, duration: 0.3 }]), 1);

    expect(out.left.every((v) => v === 0)).toBe(true);
  });
});

describe('sound score schema', () => {
  it('refuses an event on an unknown voice', () => {
    expect(soundScoreSchema.safeParse({ voices: [{ id: 'a', instrument: Instrument.Hit }], events: [{ voice: 'b', at: 0, duration: 1 }] }).success).toBe(false);
  });

  it('caps events and voices', () => {
    const voices = Array.from({ length: 40 }, (_, i) => ({ id: `v${i}`, instrument: Instrument.Click }));
    expect(soundScoreSchema.safeParse({ voices, events: [] }).success).toBe(false);
    const events = Array.from({ length: 1000 }, () => ({ voice: 'v', at: 0, duration: 0.1 }));
    expect(soundScoreSchema.safeParse({ voices: [{ id: 'v', instrument: Instrument.Click }], events }).success).toBe(false);
  });

  it('reads a note name or a frequency', () => {
    const parsed = soundScoreSchema.parse({ voices: [{ id: 'p', instrument: Instrument.Pad }], events: [{ voice: 'p', at: 0, duration: 2, note: 'A4' }] });

    expect(parsed.events[0].note).toBe('A4');
    expect(soundScoreSchema.safeParse({ voices: [{ id: 'p', instrument: Instrument.Pad }], events: [{ voice: 'p', at: 0, duration: 2, note: 'H9' }] }).success).toBe(false);
  });
});

describe('wav', () => {
  it('round-trips the samples at 16 bit', () => {
    const out = renderScore(score([{ voice: 'fx', at: 0.1, duration: 0.3 }]), 0.5);
    const back = decodeWav(encodeWav(out));

    expect(back.left.length).toBe(out.left.length);
    expect(Math.max(...back.left.map((v, i) => Math.abs(v - out.left[i])))).toBeLessThan(1e-4);
  });
});
