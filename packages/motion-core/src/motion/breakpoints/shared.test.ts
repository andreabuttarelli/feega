import { describe, expect, it } from 'vitest';
import type { MotionClip, MotionDoc } from '../doc';
import { landingDoc } from '../codegen/fixtures/landing';
import { resolveAt, viewsOf } from './model';
import { resolveView } from './view';

const PHONE = 'phone';

const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips) as MotionClip[];

const faded = (doc: MotionDoc, id: string): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => (t.clips.some((c) => c.id === id) ? { ...t, clips: t.clips.map((c) => (c.id === id ? { ...c, props: { ...c.props, opacity: 0.5 } } : c)) } : t))
});

const withPhone = (): MotionDoc => ({ ...landingDoc(), breakpoints: [{ id: PHONE, name: 'Phone', width: 390 }] });

const fresh = (doc: MotionDoc): MotionDoc => JSON.parse(JSON.stringify(doc));

describe('a breakpoint view after an edit', () => {
  const doc = withPhone();
  const edited = clipsOf(doc)[1].id;
  const after = faded(doc, edited);

  it('keeps every unchanged clip by reference', () => {
    const before = new Map(clipsOf(resolveAt(doc, PHONE)).map((c) => [c.id, c]));
    const changed = clipsOf(resolveAt(after, PHONE)).filter((c) => c.id !== edited && before.get(c.id) !== c);
    expect(changed.map((c) => c.id)).toEqual([]);
  });

  it('keeps the components by reference', () => {
    expect(resolveAt(after, PHONE).comps).toBe(resolveAt(doc, PHONE).comps);
  });

  it('resolves the same view as a doc never seen before', () => {
    resolveView(doc, PHONE);
    for (const bp of viewsOf(after).slice(1)) {
      expect(resolveView(after, bp.id)).toEqual(resolveView(fresh(after), bp.id));
    }
  });
});
