import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { Act, scriptSchema, type LaunchScript } from './script';
import { blocking, docProblems, Quality } from './direction';
import { markStory, StoryBeat } from './story';

const SITE = 'https://supasito.com/';
const PROMISE = 'Every site you run. Up to date. In one place.';
const FPS = 30;

const script = (): LaunchScript =>
  scriptSchema.parse({
    research: {
      audience: 'People who run a few websites on their Mac with Claude Code',
      problem: 'Changes to many sites scatter across folders and conversations',
      struggle: 'A client sends a new price, three sites need it and the chat about each is somewhere else',
      flow: ['Pick the site', 'Say what should change', 'See the preview', 'Publish'],
      benefits: [{ claim: 'See every change before anyone else', source: { url: SITE, quote: 'See it before it goes live' } }],
      numbers: [],
      tone: 'calm, plain',
      promise: { text: PROMISE, source: { url: SITE, quote: PROMISE } }
    },
    acts: [
      { act: Act.Problem, start: 0, end: 3, scene: 'Folders and chats', on_screen: ['The price changed.'], ui: 'Finder list: marta-bakery, cardstack-launch, supasito.com, each with 3 stale chats' },
      { act: Act.Solution, start: 3, end: 6, scene: 'The sidebar of sites, one prompt', on_screen: ['Say what should change.'], ui: 'Sidebar Supasito / Cardstack / Marta’s Bakery; prompt "Update the price to €12" typed' },
      { act: Act.Proof, start: 6, end: 10, scene: 'Before and after preview', on_screen: ['See it before it goes live.'], sources: [{ url: SITE, quote: 'See it before it goes live' }] },
      { act: Act.Claim, start: 10, end: 14, scene: 'Logo and promise', on_screen: [PROMISE, 'supasito.com'] }
    ]
  });

const text = (id: string, words: string, from: number, seconds: number): MotionClip => newClip({ id, from: from * FPS, durationInFrames: seconds * FPS, component: 'Title', props: { text: words } });
const logo = (from: number, seconds: number): MotionClip => newClip({ id: 'logo', from: from * FPS, durationInFrames: seconds * FPS, component: 'Logo', props: { assetId: 'a-logo' } });

function film(clips: MotionClip[], acts: Partial<Record<StoryBeat, number>> = { [StoryBeat.Problem]: 0, [StoryBeat.Solution]: 3, [StoryBeat.Proof]: 6, [StoryBeat.Claim]: 10 }): MotionDoc {
  const base: MotionDoc = { ...newMotionDoc(MotionFormat.Landscape), fps: FPS, durationInFrames: 14 * FPS, script: script(), tracks: [{ id: 't1', kind: 'visual', name: 'V', clips }] as MotionDoc['tracks'] };
  return Object.entries(acts).reduce((doc, [beat, second]) => markStory(doc, beat as StoryBeat, second * FPS), base);
}

const FAITHFUL = [text('p', 'The price changed.', 0, 3), text('s', 'Say what should change.', 3, 3), text('pr', 'See it before it goes live.', 6, 4), text('c1', 'Every site you run.', 10, 4), text('c2', 'Up to date. In one place.', 10, 4), text('url', 'supasito.com', 11, 3), logo(10, 4)];

const drift = (doc: MotionDoc) => docProblems(doc, { audioAssets: 0 }).filter((p) => p.kind === Quality.ScriptDrift);

describe('the video keeps to its script', () => {
  it('a film that shows every act, its key lines, the whole promise and the logo passes', () => {
    expect(drift(film(FAITHFUL))).toEqual([]);
  });

  it('a promise built word by word across clips still counts as shown', () => {
    const words = PROMISE.split(' ').map((w, i) => text(`w${i}`, w, 10 + i * 0.3, 4 - i * 0.3));
    const clips = [...FAITHFUL.filter((c) => !c.id.startsWith('c')), ...words];

    expect(drift(film(clips))).toEqual([]);
  });

  it('supasito v3: the promise cut short is named as truncated, and blocks', () => {
    const clips = FAITHFUL.map((c) => (c.id === 'c2' ? { ...c, props: { text: 'Up to date.' } } : c));
    const problems = drift(film(clips));

    expect(problems.map((p) => p.detail).join(' ')).toMatch(/In one place\." cut short/);
    expect(blocking(problems)).toHaveLength(problems.length);
  });

  it('supasito v3: a claim without the logo is named', () => {
    expect(drift(film(FAITHFUL.filter((c) => c.id !== 'logo'))).map((p) => p.detail).join(' ')).toContain('logo');
  });

  it('a key line missing from its act is named with the act', () => {
    const problems = drift(film(FAITHFUL.filter((c) => c.id !== 's')));

    expect(problems.map((p) => p.detail).join(' ')).toMatch(/solution.*Say what should change/);
  });

  it('a line shown in the wrong act does not count for its own', () => {
    const late = FAITHFUL.map((c) => (c.id === 's' ? { ...c, from: 11 * FPS } : c));

    expect(drift(film(late)).map((p) => p.detail).join(' ')).toContain('Say what should change');
  });

  it('an act never marked with mark_story is named', () => {
    expect(drift(film(FAITHFUL, { [StoryBeat.Problem]: 0, [StoryBeat.Proof]: 6, [StoryBeat.Claim]: 10 })).map((p) => p.detail).join(' ')).toContain('mark_story');
  });

  it('a line shown on a device screen counts for its act', () => {
    const onScreen = text('pr', 'See it before it goes live.', 0, 4);
    const device = newClip({ id: 'dev', from: 6 * FPS, durationInFrames: 4 * FPS, component: 'Device3D', props: { screenComp: 'phone' } });
    const base = film([...FAITHFUL.filter((c) => c.id !== 'pr'), device]);
    const doc = { ...base, comps: { phone: { name: 'Phone', durationInFrames: 4 * FPS, frame: { width: 390, height: 848 }, tracks: [{ id: 'pt', kind: 'visual', name: 'V', clips: [onScreen] }] } } } as unknown as MotionDoc;

    expect(drift(doc)).toEqual([]);
  });

  it('a line set in a shot counts for its act: shots were thrown away for titles because the gate could not read them', () => {
    const shot = (id: string, from: number, seconds: number, props: Record<string, unknown>): MotionClip => newClip({ id, from: from * FPS, durationInFrames: seconds * FPS, component: 'Custom', props: { name: 'ShotKineticTitle', ...props } });
    const clips = [shot('p', 0, 3, { text: 'The price changed.' }), ...FAITHFUL.filter((c) => c.id !== 'p' && c.id !== 'c1' && c.id !== 'c2'), shot('c', 10, 4, { name: 'ShotTaglineCard', lines: 'Every site you run.|Up to date. In one place.' })];

    expect(drift(film(clips))).toEqual([]);
  });

  it('a film without a saved script is not checked against one', () => {
    expect(drift({ ...film([]), script: undefined })).toEqual([]);
  });
});
