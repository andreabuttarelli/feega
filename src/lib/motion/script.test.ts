import { describe, expect, it } from 'vitest';
import { Act, briefOf, durationProblem, scriptProblems, scriptSchema, type LaunchScript } from './script';

const SITE = 'https://supasito.com/';

const good = (): LaunchScript =>
  scriptSchema.parse({
    research: {
      audience: 'People who run a few websites on their Mac with Claude Code',
      problem: 'Changes to many sites scatter across folders and conversations',
      struggle: 'Thursday launch, a client sends a new price, three sites need it and the chat about each is somewhere else',
      flow: ['Pick the site', 'Say what should change', 'See the preview', 'Publish'],
      benefits: [{ claim: 'See every change before anyone else', source: { url: SITE, quote: 'See it before it goes live' } }],
      numbers: [],
      tone: 'calm, plain, first person',
      promise: { text: 'Every site you run. Up to date. In one place.', source: { url: SITE, quote: 'Every site you run. Up to date. In one place.' } }
    },
    acts: [
      { act: Act.Problem, start: 0, end: 3, scene: 'A cluttered dock of folders and chats', on_screen: ['The price changed.'], ui: 'Finder list: marta-bakery, cardstack-launch, supasito.com, each with 3 stale chats and "edited 9 days ago"' },
      { act: Act.Solution, start: 3, end: 7, scene: 'The sidebar of sites, one prompt', on_screen: ['Say what should change.'], ui: 'Sidebar Supasito / Cardstack / Marta’s Bakery; prompt "Update the price to €12" typed; preview pane; Publish pressed' },
      { act: Act.Proof, start: 7, end: 11, scene: 'Before and after preview', on_screen: ['See it before it goes live.'], sources: [{ url: SITE, quote: 'See it before it goes live' }] },
      { act: Act.Claim, start: 11, end: 14, scene: 'Logo and promise', on_screen: ['Every site you run.', 'Up to date.', 'In one place.', 'supasito.com'] }
    ]
  });

describe('the launch script', () => {
  it('passes a script with a real before, the real flow, sourced proof and the site promise', () => {
    expect(scriptProblems(good())).toEqual([]);
  });

  it('refuses a solution described as empty boxes', () => {
    const s = good();
    s.acts[1].ui = 'a card grid';

    expect(scriptProblems(s).join(' ')).toContain('real flow');
  });

  it('refuses proof without a source on the site', () => {
    const s = good();
    s.acts[2].sources = [];

    expect(scriptProblems(s).join(' ')).toContain('number or a result');
  });

  it('refuses a claim that is not the site promise', () => {
    const s = good();
    s.acts[3].on_screen = ['Websites, reimagined.'];

    expect(scriptProblems(s).join(' ')).toContain('own promise');
  });

  it('feega v7: refuses more on-screen lines than its length can show (14 lines in 15 s grew the cut to 52 s)', () => {
    const s = good();
    s.acts[1].on_screen = ['Say what should change.', 'Pick the site.', 'Type the price.', 'See the preview.', 'Press publish.', 'Done.'];
    s.acts[2].on_screen = ['See it before it goes live.', 'Every change.', 'Every site.', 'One place.'];

    expect(scriptProblems(s).join(' ')).toMatch(/15 on-screen lines.*14 s/);
  });

  it('refuses acts out of order', () => {
    const s = good();
    s.acts = [s.acts[1], s.acts[0], s.acts[2], s.acts[3]];

    expect(scriptProblems(s)[0]).toContain('in this order');
  });

  it.each([
    [14, null],
    [11.3, null],
    [16.7, null],
    [52.6, 'the video runs 52.6 s, the script 14 s'],
    [10, 'the video runs 10 s, the script 14 s']
  ])('a %s s video against a 14 s script: %s', (seconds, problem) => {
    const found = durationProblem(seconds, good());

    expect(problem === null ? found : found?.startsWith(problem)).toBe(problem === null ? null : true);
  });

  it('writes a brief that cites every claim', () => {
    expect(briefOf(good())).toContain('"See it before it goes live" (https://supasito.com/)');
  });

  it('refuses an on-screen line over six words and offers the cut (v5: "the texts make no sense")', async () => {
    const { MAX_LINE_WORDS } = await import('./script');
    const s = good();
    s.acts[0].on_screen = ['Unlock the synergy of your whole digital presence'];

    expect(scriptProblems(s).join(' ')).toMatch(new RegExp(`at most ${MAX_LINE_WORDS}.*cut it to "Unlock the synergy of your whole"`));
  });

  it('refuses a line said twice: each line appears once (v7: the tagline closed two acts)', () => {
    const s = good();
    s.acts[1].on_screen = [...s.acts[3].on_screen.slice(0, 1)];

    expect(scriptProblems(s).join(' ')).toContain(`"${s.acts[3].on_screen[0]}" appears twice`);
  });
});

