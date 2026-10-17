import { describe, expect, it } from 'vitest';
import { BREAKDOWN_VERSION, breakdownBrief, parseBreakdown } from './video-reference';

const answer = {
  summary: 'A SaaS launch: prompt typed, result appears.',
  durationS: 8,
  voiceover: [{ start: 0, end: 2.5, text: 'Meet the new editor.' }],
  scenes: [
    { start: 0, end: 3, description: 'Title card', onScreenText: ['Meet feega'], ui: [], camera: 'slow push in', transitionOut: 'whip pan' },
    { start: 3, end: 8, description: 'Prompt field types', onScreenText: [], ui: ['prompt input', 'send button'], camera: 'zoom on the field', transitionOut: 'cut' }
  ],
  pacing: { cutsPerMinute: 15, rhythm: 'changes every bar, holds after each change' },
  palette: ['#0A0A0A', '#FFFFFF'],
  typography: ['Inter semibold, tight tracking'],
  music: 'minimal electronic, 120 BPM'
};

describe('parseBreakdown', () => {
  it('reads the model answer even when it is wrapped in a json fence', () => {
    const parsed = parseBreakdown('```json\n' + JSON.stringify(answer) + '\n```');

    expect(parsed).toMatchObject({ version: BREAKDOWN_VERSION, durationS: 8, scenes: [{ onScreenText: ['Meet feega'] }, { ui: ['prompt input', 'send button'] }] });
  });

  it('fills the lists the model left out instead of refusing the whole answer', () => {
    const parsed = parseBreakdown(JSON.stringify({ durationS: 4, scenes: [{ start: 0, end: 4 }], pacing: { cutsPerMinute: 0, rhythm: 'one shot' } }));

    expect(parsed?.voiceover).toEqual([]);
    expect(parsed?.scenes[0]).toMatchObject({ onScreenText: [], ui: [], camera: '', transitionOut: '' });
  });

  it('answers null for prose or a shape without scenes timing', () => {
    expect(parseBreakdown('I cannot watch videos.')).toBeNull();
    expect(parseBreakdown(JSON.stringify({ summary: 'x' }))).toBeNull();
  });
});

describe('breakdownBrief', () => {
  it('gives the agent script, scenes with durations, ui, transitions, pacing, palette and type', () => {
    const brief = breakdownBrief(parseBreakdown(JSON.stringify(answer))!);

    expect(brief).toContain('8 s');
    expect(brief).toContain('0–2.5 s "Meet the new editor."');
    expect(brief).toContain('1. 0–3 s (3 s) Title card');
    expect(brief).toContain('Text: "Meet feega"');
    expect(brief).toContain('UI: prompt input, send button');
    expect(brief).toContain('Transition out: whip pan');
    expect(brief).toContain('15 cuts/min');
    expect(brief).toContain('#0A0A0A');
    expect(brief).toContain('Inter semibold');
  });
});
