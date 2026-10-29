import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { nextDoc, stepOf } from './frame-step';

const ASSET = '0a1b2c3d-1111-4222-8333-444455556666';

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

const start = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'a', x: 0.2 } }, 'a'));

const withProps = (doc: MotionDoc, props: Record<string, unknown>): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === 'a' ? { ...c, props: { ...c.props, ...props } } : c)) }))
});

describe('a saved revision travels to peers as the ops that made it', () => {
  it('the next revision becomes the ops from the one before', () => {
    const moved = withProps(start, { x: 0.4 });
    const step = stepOf('n1', { version: 3, doc: start }, { version: 4, doc: moved });

    expect(step).toMatchObject({ nodeId: 'n1', base: 3, version: 4 });
    expect(nextDoc({ version: 3, doc: start, assets: {} }, step!)).toEqual(moved);
  });

  it('a save that skipped revisions is no step: the peer fetches the head', () => {
    expect(stepOf('n1', { version: 3, doc: start }, { version: 5, doc: withProps(start, { x: 0.4 }) })).toBeNull();
  });

  it('a save that changed nothing is no step', () => {
    expect(stepOf('n1', { version: 3, doc: start }, { version: 4, doc: start })).toBeNull();
  });
});

describe('a peer applies a step only onto the revision it was made from', () => {
  const step = stepOf('n1', { version: 3, doc: start }, { version: 4, doc: withProps(start, { x: 0.4 }) })!;

  it('a peer holding another revision cannot apply it', () => {
    expect(nextDoc({ version: 2, doc: start, assets: {} }, step)).toBeNull();
    expect(nextDoc({ version: 4, doc: start, assets: {} }, step)).toBeNull();
  });

  it('a step that brings in a file the peer has no address for is fetched instead', () => {
    const pictured = stepOf('n1', { version: 3, doc: start }, { version: 4, doc: withProps(start, { src: ASSET }) })!;

    expect(nextDoc({ version: 3, doc: start, assets: {} }, pictured)).toBeNull();
    expect(nextDoc({ version: 3, doc: start, assets: { [ASSET]: 'https://files/a.png' } }, pictured)).toEqual(withProps(start, { src: ASSET }));
  });
});
