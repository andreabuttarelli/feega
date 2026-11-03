import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { coloursMerged } from './page-colours';

function docWith(fills: string[], text: string): MotionDoc {
  let doc: MotionDoc = newMotionDoc(MotionFormat.Landscape);
  for (const [i, fill] of fills.entries()) {
    const added = addClip(doc, { component: 'Shape', from: 0, durationInFrames: 30, props: { x: 0.5, y: 0.5, width: 0.1, height: 0.1, fill, strokes: [{ paint: { type: 'solid', color: fill } }] } }, `s${i}`);
    doc = added.ok ? added.doc : doc;
  }
  const added = addClip(doc, { component: 'Text', from: 0, durationInFrames: 30, props: { x: 0.5, y: 0.5, text: 'Hi', color: text } }, 't');
  return added.ok ? added.doc : doc;
}

const paintOf = (c: MotionClip) => [c.props.fill, c.props.color, ...((c.props.strokes as { paint: { color: string } }[] | undefined) ?? []).map((s) => s.paint.color)];

const coloursIn = (doc: MotionDoc) => [...new Set(doc.tracks.flatMap((t) => t.clips as MotionClip[]).flatMap(paintOf).filter((v): v is string => typeof v === 'string'))].sort();

describe('an imported page holds one colour where the page used several it cannot tell apart', () => {
  it('turns #fdfeff into the #ffffff the page uses more, in fills, strokes and text', () => {
    const merged = coloursMerged(docWith(['#ffffff', '#ffffff', '#FDFEFF'], '#fdfeff'));

    expect(coloursIn(merged)).toEqual(['#ffffff']);
  });

  it('keeps colours a person can tell apart', () => {
    const merged = coloursMerged(docWith(['#ffffff', '#f2f2f2', '#0070f3'], '#0072f5'));

    expect(coloursIn(merged)).toEqual(['#0070f3', '#f2f2f2', '#ffffff']);
  });

  it('keeps the alpha of a colour it merges', () => {
    const doc = docWith(['#ffffff', '#ffffff', '#fdfeff'], '#ffffff');
    const faded = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 's2' ? { ...c, props: { ...c.props, fill: '#fdfeff80', strokes: [] } } : c)) })) };

    const merged = coloursMerged(faded);

    expect(coloursIn(merged)).toEqual(['#ffffff', '#ffffff80']);
  });
});
