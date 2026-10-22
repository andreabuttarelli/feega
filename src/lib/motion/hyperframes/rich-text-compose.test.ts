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

  it('carries family, size, spacing, decoration, case and opacity on the span', () => {
    const html = compose(docWith({ text: 'plain big', runs: [{ start: 6, end: 9, font: 'Inter', size: 0.2, tracking: 0.1, leading: 1.5, underline: true, strike: true, textCase: 'upper', opacity: 0.5 }] }));
    const span = html.match(/<span style="([^"]*)">big<\/span>/)?.[1] ?? '';
    expect(span).toContain('font-size:5em');
    expect(span).toContain('letter-spacing:0.1em');
    expect(span).toContain('line-height:1.5');
    expect(span).toContain('text-decoration:underline line-through');
    expect(span).toContain('text-transform:uppercase');
    expect(span).toContain('opacity:0.5');
    expect(span).toMatch(/font-family:[^;]*Inter/);
  });

  it('a text without runs renders as before', () => {
    expect(compose(docWith({ text: 'plain' }))).not.toContain('font-style:italic');
  });
});
