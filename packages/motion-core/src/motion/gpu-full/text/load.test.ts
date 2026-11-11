import { describe, expect, it } from 'vitest';
import { FEEGA_TOKENS } from '../../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../../doc';
import { addClip } from '../../timeline';
import { fontLoader, type Reader } from './load';

function titled(text: string): MotionDoc {
  const next = addClip({ ...newMotionDoc(MotionFormat.Square), durationInFrames: 30 }, { component: 'Title', from: 0, durationInFrames: 30, props: { text } }, 't');
  if (!next.ok) {
    throw new Error(next.error);
  }
  return next.doc;
}

function recording(): { read: Reader; sheets: string[] } {
  const sheets: string[] = [];
  return { sheets, read: { text: async (url) => (sheets.push(url), ''), bytes: async () => new Uint8Array() } };
}

describe('font loading', () => {
  it('asks the symbol fallback by family, not as a text subset that Google serves without CORS', async () => {
    const { read, sheets } = recording();
    const load = fontLoader(read, async () => () => ({}) as never);

    await load(titled('a → b'), {}, FEEGA_TOKENS);

    const symbols = sheets.filter((u) => u.includes('Noto'));
    expect(symbols.length).toBeGreaterThan(0);
    expect(symbols.every((u) => !u.includes('text='))).toBe(true);
  });

  it('two frames with different symbols share one fallback sheet', async () => {
    const { read, sheets } = recording();
    const load = fontLoader(read, async () => () => ({}) as never);

    await load(titled('a → b'), {}, FEEGA_TOKENS);
    await load(titled('c ✓ d'), {}, FEEGA_TOKENS);

    expect(new Set(sheets.filter((u) => u.includes('Noto'))).size).toBe(1);
  });
});
