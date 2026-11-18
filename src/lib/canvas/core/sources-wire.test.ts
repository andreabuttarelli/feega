import { describe, expect, it, vi } from 'vitest';
import { readSources, writeSources } from './sources-wire';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const doc = (tag: string) => ({ tag, text: 'line one\nline two', tracks: [{ clips: [{ id: `${tag}-clip` }] }] });

describe('the frame sources of a canvas on the wire', () => {
  it('read back as what was written: the tokens, the signed links and each frame', () => {
    const text = writeSources({ tokens: { t: 1 }, signed: { p: 'https://signed/p' } }, [
      { meta: { id: A, revision: 3, assets: { p: '/a/p' }, media: {} }, docText: JSON.stringify(doc('a')) },
      { meta: { id: B, revision: 5, assets: {} }, docText: JSON.stringify(doc('b')) }
    ]);

    const { head, frames } = readSources(text)!;

    expect(head).toEqual({ tokens: { t: 1 }, signed: { p: 'https://signed/p' } });
    expect(frames.get(A)?.meta).toEqual({ id: A, revision: 3, assets: { p: '/a/p' }, media: {} });
    expect(JSON.parse(frames.get(A)!.docText)).toEqual(doc('a'));
    expect(JSON.parse(frames.get(B)!.docText)).toEqual(doc('b'));
  });

  it('hand each doc over as its text, never parsed on the way (the page parsed 1.15 MB per frame only to write it out again for the worker)', () => {
    const texts = [JSON.stringify(doc('a')), JSON.stringify(doc('b'))];
    const text = writeSources({ tokens: null }, [
      { meta: { id: A, revision: 1, assets: {} }, docText: texts[0] },
      { meta: { id: B, revision: 1, assets: {} }, docText: texts[1] }
    ]);
    const parsed = vi.spyOn(JSON, 'parse');

    const { frames } = readSources(text)!;
    const docParses = parsed.mock.calls.filter(([value]) => typeof value === 'string' && value.includes('"tracks"')).length;
    parsed.mockRestore();

    expect(docParses).toBe(0);
    expect([...frames.values()].map((f) => f.docText)).toEqual(texts);
  });

  it('read an answer with no frames as an empty batch', () => {
    expect(readSources(writeSources({ tokens: {} }, []))!.frames.size).toBe(0);
  });

  it('read the single JSON object an older server answers as no batch, never as a batch without frames', () => {
    const older = JSON.stringify({ tokens: {}, frames: { [A]: { revision: 3, doc: doc('a'), assets: {} } }, signed: {} });

    expect(readSources(older)).toBeNull();
  });

  it('are not one JSON document, so a page from an older deploy fails its json() read and asks frame by frame', () => {
    const text = writeSources({ tokens: {} }, [{ meta: { id: A, revision: 1, assets: {} }, docText: JSON.stringify(doc('a')) }]);

    expect(() => JSON.parse(text)).toThrow();
  });
});
