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

describe('lists in the HTML export', () => {
  const bullet = (level = 0) => ({ kind: 'bullet', level });
  const number = (level = 0) => ({ kind: 'number', level });

  it('hangs a bullet in the gutter and indents the item one step', () => {
    const html = compose({ text: 'one', lists: [bullet()] });

    expect(html).toMatch(/<div style="[^"]*position:relative[^"]*padding-left:1\.5em[^"]*"><span style="[^"]*position:absolute[^"]*width:1\.1em[^"]*text-align:right[^"]*">•<\/span>one<\/div>/);
  });

  it('numbers items and nests the next level one step further', () => {
    const html = compose({ text: 'a\nb\nc', lists: [number(), number(1), number()] });

    expect(html).toMatch(/>1\.<\/span>a<\/div>/);
    expect(html).toMatch(/padding-left:3em[^"]*"><span[^>]*>a\.<\/span>b<\/div>/);
    expect(html).toMatch(/>2\.<\/span>c<\/div>/);
  });

  it('leaves a plain paragraph without a marker and keeps paragraph spacing', () => {
    const html = compose({ text: 'a\nb', paragraphSpacing: 0.5, lists: [null, bullet()] });

    expect(html).toMatch(/<div style="[^"]*margin-bottom:0.5em[^"]*">a<\/div>/);
    expect(html).toMatch(/margin-bottom:0em[^"]*"><span[^>]*>•<\/span>b<\/div>/);
  });

  it('keeps the first-line indent next to the list indent', () => {
    expect(compose({ text: 'a', paragraphIndent: 2, lists: [bullet()] })).toMatch(/padding-left:1\.5em[^"]*text-indent:2em|text-indent:2em[^"]*padding-left:1\.5em/);
  });
});

describe('links in the HTML export', () => {
  it('wraps a linked range in an anchor that opens a new tab safely', () => {
    const html = compose({ text: 'see docs', runs: [{ start: 4, end: 8, link: 'https://feega.app/docs?a=1&b=2' }] });

    expect(html).toMatch(/see <a href="https:\/\/feega\.app\/docs\?a=1&amp;b=2" target="_blank" rel="noopener noreferrer" style="[^"]*">docs<\/a>/);
  });

  it('keeps the text colour instead of the browser link blue', () => {
    const html = compose({ text: 'abc', runs: [{ start: 0, end: 3, link: 'https://a.co' }] });

    expect(html).toMatch(/<a [^>]*style="color:inherit;/);
  });

  it('underlines a link', () => {
    const html = compose({ text: 'abc', runs: [{ start: 0, end: 3, link: 'https://a.co' }] });

    expect(html).toMatch(/<a [^>]*style="[^"]*text-decoration:underline/);
  });
});
