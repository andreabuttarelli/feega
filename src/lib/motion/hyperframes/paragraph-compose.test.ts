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

const compose = (props: Record<string, unknown>) => composeHtml({ doc: docWith(props), tokens: FEEGA_TOKENS, assets: {}, origin: 'https://app.test' });

describe('paragraph typography in the HTML export', () => {
  it('justifies the text', () => {
    expect(compose({ text: 'a b', align: 'justify' })).toContain('text-align:justify');
  });

  it('pins a fixed text to the bottom of its box', () => {
    expect(compose({ text: 'a', verticalAlign: 'bottom' })).toContain('justify-content:flex-end');
  });

  it('spaces and indents every paragraph but adds no space after the last', () => {
    const html = compose({ text: 'one\ntwo', paragraphSpacing: 0.5, paragraphIndent: 2 });

    expect(html).toMatch(/<div style="[^"]*text-indent:2em[^"]*margin-bottom:0.5em[^"]*">one<\/div>/);
    expect(html).toMatch(/<div style="[^"]*text-indent:2em[^"]*margin-bottom:0em[^"]*">two<\/div>/);
  });

  it('keeps a styled range inside its paragraph', () => {
    const html = compose({ text: 'one\ntwo', paragraphSpacing: 1, runs: [{ start: 2, end: 6, weight: 700 }] });

    expect(html).toMatch(/>on<span style="[^"]*">e<\/span><\/div>/);
    expect(html).toMatch(/"><span style="[^"]*">tw<\/span>o<\/div>/);
  });

  it('title-cases with a text transform', () => {
    expect(compose({ text: 'a b', textCase: 'title' })).toContain('text-transform:capitalize');
  });
});
