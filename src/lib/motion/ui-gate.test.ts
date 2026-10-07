import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, type MotionClip, type MotionDoc } from './doc';
import { blocking, docProblems, Quality } from './direction';
import { CURSOR_PIECE } from './clicks';

const film = (clips: MotionClip[]): MotionDoc => ({ ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 450, tracks: [{ id: 't1', kind: 'visual', name: 'V', clips }] as MotionDoc['tracks'] });

const ui = (id: string, props: Record<string, unknown>, from = 0) => newClip({ id, from, durationInFrames: 90, component: 'Custom', props });

const kinds = (doc: MotionDoc) => docProblems(doc, { audioAssets: 0 }).map((p) => p.kind);

const V2_CARDS = 'Studio site|Published today\nShop|Up to date\nBlog|Up to date\nPortfolio|Up to date\nDocs|Up to date\nLanding|Up to date';
const REAL_CARDS = 'Studio Rossi|Pricing updated 2 min ago\nBottega shop|3 products added\nTravel blog|Draft: Lisbon in 48h\nPortfolio|New case study live';

describe('the gate on product UI', () => {
  it('blocks the supasito v2 card grid: one subtitle repeated on every card', () => {
    const problems = docProblems(film([ui('grid', { name: 'UiCardGrid', cards: V2_CARDS })]), { audioAssets: 0 });

    expect(blocking(problems).map((p) => p.kind)).toContain(Quality.EmptyUi);
  });

  it('blocks a kit piece left on its sample text', () => {
    expect(kinds(film([ui('hero', { name: 'UiHero' })]))).toContain(Quality.EmptyUi);
  });

  it('blocks placeholder copy', () => {
    expect(kinds(film([ui('box', { name: 'UiPromptBox', label: 'Label', prompt: 'Lorem ipsum dolor', done: 'Done' })]))).toContain(Quality.EmptyUi);
  });

  it('lets specific, product-true content through', () => {
    expect(kinds(film([ui('grid', { name: 'UiCardGrid', cards: REAL_CARDS })]))).not.toContain(Quality.EmptyUi);
  });

  it('blocks a cursor click that misses its button', () => {
    const doc = film([ui('box', { name: 'UiPromptBox', label: 'Say what should change', prompt: 'Make the menu page show the autumn dishes', done: 'Published in 9 seconds' }), newClip({ id: 'cur', from: 0, durationInFrames: 90, component: 'Custom', props: { name: CURSOR_PIECE, path: '0.76|0.52|1.5|box#send' } })]);

    expect(blocking(docProblems(doc, { audioAssets: 0 })).map((p) => p.kind)).toContain(Quality.ClickMiss);
  });

  it('warns when a UI only slides around and nothing in it reacts', () => {
    const problems = docProblems(film([ui('stats', { name: 'UiStatCards', title: 'Visitors this week', stats: 'Visitors|12,480\nSignups|318' })]), { audioAssets: 0 });

    expect(problems.find((p) => p.kind === Quality.NoMicroMotion)).toBeDefined();
    expect(blocking(problems).map((p) => p.kind)).not.toContain(Quality.NoMicroMotion);
  });
});
