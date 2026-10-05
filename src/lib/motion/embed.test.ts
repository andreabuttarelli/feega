import { describe, expect, it } from 'vitest';
import { MotionFormat, clipsOf, newMotionDoc, parseMotionDoc, type MotionDoc } from './doc';
import { addClip, type OpResult } from './timeline';
import { flattenComps, precompose } from './precomp';
import { embedMotion, motionCompId } from './embed';

function must(r: OpResult): MotionDoc {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
}

const source = (() => {
  let doc = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 45 }, 'title'));
  doc = must(addClip(doc, { component: 'Audio', from: 0, durationInFrames: 45 }, 'music'));
  doc = must(precompose(doc, ['title'], { comp: 'inner', clip: 'pc' }, 'Inner'));
  return { ...doc, durationInFrames: 60, assets: [{ id: 'logo', kind: 'image' as const, name: 'Logo' }] };
})();

const host = newMotionDoc(MotionFormat.Landscape);

describe('a motion editor embedded in another video', () => {
  it('becomes one composition of the host, as long as the source, with its picture tracks only', () => {
    const doc = embedMotion(host, 'node-1', source);
    const comp = doc.comps[motionCompId('node-1')];

    expect(comp.durationInFrames).toBe(60);
    expect(comp.tracks.flatMap((t) => t.clips.map((c) => c.component))).toEqual(['Precomp']);
  });

  it('keeps its own compositions under its own names, so nothing of the host can be reached from inside', () => {
    const doc = embedMotion({ ...host, comps: { inner: { name: 'Host inner', durationInFrames: 10, tracks: [] } } }, 'node-1', source);
    const outer = doc.comps[motionCompId('node-1')];
    const nested = String(outer.tracks[0].clips[0].props.comp);

    expect(nested).not.toBe('inner');
    expect(doc.comps[nested].name).toBe('Inner');
    expect(doc.comps.inner.name).toBe('Host inner');
    expect(parseMotionDoc(doc).ok).toBe(true);
  });

  it('brings its assets along, once', () => {
    const doc = embedMotion(embedMotion(host, 'node-1', source), 'node-2', source);

    expect(doc.assets.map((a) => a.id)).toEqual(['logo']);
  });

  it('plays live: a precomp of it flattens into the source clips', () => {
    let doc = embedMotion(host, 'node-1', source);
    doc = must(addClip(doc, { component: 'Precomp', from: 0, durationInFrames: 60, props: { comp: motionCompId('node-1') } }, 'slot'));

    expect(clipsOf(flattenComps(doc)).some((c) => c.id.endsWith('__title'))).toBe(true);
  });
});
