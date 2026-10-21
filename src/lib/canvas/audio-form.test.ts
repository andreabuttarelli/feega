import { describe, expect, it } from 'vitest';
import { AudioFieldKind, audioFormOf } from './audio-form';

const kinds = (params: Record<string, unknown>, model: string | null = null) => audioFormOf({ params, model }).map((f) => `${f.kind}:${f.label}`);

describe('audioFormOf — the controls the audio card shows above its prompt', () => {
  it('text to speech: operation, model, voice with its more-voices button, and three sliders', () => {
    expect(kinds({})).toEqual(['select:Operation', 'select:Model', 'voice:Voice', 'more:', 'slider:Stability', 'slider:Similarity', 'slider:Style']);
  });

  it('shows the picked voice by name and a slider at its value, the middle when unset', () => {
    const form = audioFormOf({ params: { voiceName: 'Rachel', stability: 0.8 }, model: null });

    expect(form.find((f) => f.kind === AudioFieldKind.Voice)?.value).toBe('Rachel');
    expect(form.find((f) => f.label === 'Stability')?.ratio).toBe(0.8);
    expect(form.find((f) => f.label === 'Style')?.ratio).toBe(0.5);
  });

  it('dubbing asks for a language, music for seconds', () => {
    expect(audioFormOf({ params: { operation: 'dubbing' }, model: null }).find((f) => f.label === 'Language')?.value).toBe('Pick a language');
    expect(kinds({ operation: 'music' })).toContain('number:Seconds');
  });
});
