// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newClip, newMotionDoc, type MotionDoc } from '../doc';
import { COMPONENTS } from '../components';
import { composeHtml } from './compose';

function docWith(props: Record<string, unknown>): MotionDoc {
  const doc = newMotionDoc(MotionFormat.Square);
  const clip = newClip({ id: 't1', from: 0, durationInFrames: doc.durationInFrames, component: 'Text', props: COMPONENTS.Text.schema.parse(props) as Record<string, unknown> });
  return { ...doc, tracks: doc.tracks.map((t, i) => (i === 0 ? { ...t, clips: [clip] } : t)) };
}

const compose = (doc: MotionDoc) => composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, origin: 'https://app.test' });

describe('rich text in the HTML export', () => {
  it('wraps each run in a span with its colour, weight and slant', () => {
    const html = compose(docWith({ text: 'plain bold', runs: [{ start: 6, end: 10, weight: 700, italic: true, color: '#ff0000' }] }));
    expect(html).toMatch(/plain <span style="[^"]*font-weight:700[^"]*">bold<\/span>/);
    expect(html).toMatch(/<span style="[^"]*font-style:italic[^"]*">bold/);
    expect(html).toMatch(/<span style="[^"]*color:#ff0000[^"]*">bold/);
  });

  it('a text without runs renders as before', () => {
    expect(compose(docWith({ text: 'plain' }))).not.toContain('font-style:italic');
  });
});
