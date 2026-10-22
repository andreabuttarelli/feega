// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newClip, newMotionDoc, type MotionDoc } from '../doc';
import { COMPONENTS } from '../components';
import { composeHtml } from './compose';

function docWith(props: Record<string, unknown>): MotionDoc {
  const doc = newMotionDoc(MotionFormat.Square);
  const clip = newClip({ id: 't1', from: 0, durationInFrames: doc.durationInFrames, component: 'Text', props: COMPONENTS.Text.schema.parse({ size: 0.05, ...props }) as Record<string, unknown> });
  return { ...doc, tracks: doc.tracks.map((t, i) => (i === 0 ? { ...t, clips: [clip] } : t)) };
}

const compose = (props: Record<string, unknown>) => composeHtml({ doc: docWith(props), tokens: FEEGA_TOKENS, assets: {}, origin: 'https://app.test' });

describe('line typography in the HTML export', () => {
  it('writes line height and letter spacing in em of the type size', () => {
    const html = compose({ lineHeight: '108px', letterSpacing: '10%' });

    expect(html).toContain('line-height:2');
    expect(html).toContain('letter-spacing:0.1em');
  });

  it('auto line height is the font normal', () => {
    expect(compose({ lineHeight: 'auto' })).toContain('line-height:normal');
  });

  it('clamps to max lines when truncating, and stops fitting', () => {
    const html = compose({ text: 'a b c', truncate: true, maxLines: 2 });

    expect(html).toContain('-webkit-line-clamp:2');
    expect(html).not.toMatch(/id="tx-t1" data-fit/);
  });

  it('balances and trims', () => {
    const html = compose({ textWrap: 'balance', leadingTrim: 'cap' });

    expect(html).toContain('text-wrap-style:balance');
    expect(html).toContain('text-box:trim-both cap alphabetic');
  });
});
