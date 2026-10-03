import { describe, expect, it } from 'vitest';
import type React from 'react';
import { Sequence } from 'remotion';
import { FEEGA_TOKENS } from '../brand';
import { MotionFormat, newMotionDoc, type MotionDoc } from '../doc';
import { addClip, addTrack } from '../timeline';
import { TrackKind } from '../components';
import { renderDoc } from './MotionComposition';

function must(r: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

type El = React.ReactElement<{ children: El[]; from: number; durationInFrames: number; name: string }>;

function sequences(doc: MotionDoc): El[] {
  const root = renderDoc({ doc, tokens: FEEGA_TOKENS, assets: {} }) as El;
  return root.props.children.flat();
}

describe('renderDoc', () => {
  const base = must(addTrack(newMotionDoc(MotionFormat.Landscape), TrackKind.Visual, 'v0'));
  const doc = must(addClip(must(addClip(base, { component: 'BrandBackground', from: 0, durationInFrames: 450, trackId: 'v1' }, 'bg')), { component: 'Title', from: 15, durationInFrames: 60, trackId: 'v0' }, 'title'));

  it('one Sequence per clip, at the clip timing', () => {
    const seqs = sequences(doc);

    expect(seqs.every((s) => s.type === Sequence)).toBe(true);
    expect(seqs.map((s) => [s.props.from, s.props.durationInFrames])).toEqual([
      [0, 450],
      [15, 60]
    ]);
  });

  it('the first track is drawn last, on top', () => {
    expect(sequences(doc).map((s) => s.key)).toEqual(['bg', 'title']);
  });

  it('is deterministic: the same doc renders the same tree', () => {
    expect(JSON.stringify(sequences(doc).map((s) => s.props.name))).toBe(JSON.stringify(sequences(structuredClone(doc)).map((s) => s.props.name)));
  });
});
