import { describe, expect, it } from 'vitest';
import { scriptProblems, type LaunchScript } from '$lib/motion/script';
import { applyCopy, copyPrompt, copywrite } from './copywriter';

const source = { url: 'https://supasito.com/', quote: 'Every site you run. Up to date. In one place.' };
const SCRIPT: LaunchScript = {
  brand: 'real' as never,
  research: { audience: 'People who run several websites', problem: 'Changes scatter across chats', struggle: 'A client sends a new price for three sites', flow: ['Pick the site', 'Say what should change'], benefits: [{ claim: 'One place', source }], numbers: [{ value: '3x faster', source }], tone: 'calm', promise: { text: 'Every site you run. Up to date. In one place.', source } },
  acts: [
    { act: 'problem' as never, start: 0, end: 3, scene: 'Scattered folders', on_screen: ['Unlock the synergy of your digital presence today'], ui: 'Finder: marta-bakery, cardstack-launch, supasito.com, each edited 9 days ago', sources: [] },
    { act: 'solution' as never, start: 3, end: 7, scene: 'One prompt', on_screen: ['Magic.'], ui: 'Sidebar Supasito, Cardstack, Marta Bakery; prompt Set the price to 12; preview', sources: [] },
    { act: 'proof' as never, start: 7, end: 11, scene: 'Preview', on_screen: ['Wow'], ui: '', sources: [source] },
    { act: 'claim' as never, start: 11, end: 14, scene: 'Logo', on_screen: ['Every site you run.', 'Up to date.', 'In one place.'], ui: '', sources: [] }
  ]
};

const LINES = {
  acts: [
    { act: 'problem', on_screen: ['Three sites. One new price.'] },
    { act: 'solution', on_screen: ['Pick the site.', 'Say the change.'] },
    { act: 'proof', on_screen: ['3x faster updates.'] },
    { act: 'claim', on_screen: ['Every site you run.', 'Up to date.', 'In one place.', 'supasito.com'] }
  ]
};

describe('the copywriter', () => {
  it('is briefed with the real facts: who, the problem, how it works, the proof, the promise, and the url to close on', () => {
    const prompt = copyPrompt(SCRIPT);

    expect(prompt).toContain('one language for every line: the language of the site');
    expect(prompt).toContain('verbatim');
    for (const fact of ['People who run several websites', 'Changes scatter across chats', 'Pick the site', '3x faster', 'Every site you run', 'supasito.com', 'at most 6 words']) {
      expect(prompt).toContain(fact);
    }
  });

  it('its lines replace the director lines, act by act, and the script still passes', () => {
    const copied = applyCopy(SCRIPT, LINES);

    expect(copied.acts.map((a) => a.on_screen)).toEqual(LINES.acts.map((a) => a.on_screen));
    expect(scriptProblems(copied)).toEqual([]);
  });

  it('lines that break the rules are not taken: the director lines stay and the script check says why', () => {
    const long = { acts: LINES.acts.map((a, i) => (i === 0 ? { ...a, on_screen: ['This line is far too long for one card'] } : a)) };

    expect(applyCopy(SCRIPT, long)).toBe(SCRIPT);
    expect(applyCopy(SCRIPT, { acts: [] })).toBe(SCRIPT);
  });

  it('a one-sentence tagline split across cards, as "Make / your brand / move." came back, is put back on one card', () => {
    const promise = { text: 'Make your brand move.', source: { ...source, quote: 'Make your brand move.' } };
    const moving = { ...SCRIPT, research: { ...SCRIPT.research, promise } };
    const split = { acts: LINES.acts.map((a) => (a.act === 'claim' ? { ...a, on_screen: ['Make', 'your brand', 'move.', 'supasito.com'] } : a)) };

    const claim = applyCopy(moving, split).acts.find((a) => a.act === 'claim');

    expect(claim?.on_screen).toEqual(['Make your brand move.', 'supasito.com']);
    expect(copyPrompt(SCRIPT)).toContain('never split a sentence');
  });

  it('a failing copywriter costs nothing more than its call and keeps the script', async () => {
    const out = await copywrite({ ask: async () => { throw new Error('down'); } }, SCRIPT);

    expect(out).toEqual({ script: SCRIPT, usd: 0 });
  });

  it('reports what the copywriter cost', async () => {
    const out = await copywrite({ ask: async () => ({ answer: LINES, usd: 0.02 }) }, SCRIPT);

    expect(out.usd).toBe(0.02);
    expect(out.script.acts[0].on_screen).toEqual(['Three sites. One new price.']);
  });
});
