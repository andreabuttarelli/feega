import { describe, expect, it } from 'vitest';
import { AD_TEMPLATES, AdTemplate, templateAssets } from './ad-templates';
import { clipsOf, parseMotionDoc, type MotionClip } from './doc';
import { CardKind, type RingCard } from './ring/model';

const doc = AD_TEMPLATES[AdTemplate.UiRing].build(templateAssets([]));
const ring = clipsOf(doc).find((c) => c.component === 'Ring') as MotionClip;

describe('the UI ring template', () => {
  it('is a valid video with one ring of dashboard cards', () => {
    expect(parseMotionDoc(doc).ok).toBe(true);
    expect(ring).toBeDefined();
  });

  it('fills every card with a composition of the video', () => {
    const cards = ring.props.cards as RingCard[];

    expect(cards.length).toBeGreaterThanOrEqual(4);
    expect(cards.every((c) => c.kind === CardKind.Comp && doc.comps[c.ref])).toBe(true);
  });

  it('draws its charts with shapes and animates its numbers', () => {
    for (const card of ring.props.cards as RingCard[]) {
      const clips = doc.comps[card.ref].tracks.flatMap((t) => t.clips as MotionClip[]);

      expect(clips.some((c) => c.component === 'Shape' && Object.keys(c.keyframes).length > 0)).toBe(true);
      expect(clips.some((c) => c.component === 'Title')).toBe(true);
    }
  });

  it('turns a whole number of times in the video, so it loops', () => {
    const turns = Number(ring.props.turns) * (ring.durationInFrames / (Number(ring.props.loop) * doc.fps));

    expect(Number.isInteger(turns)).toBe(true);
    expect(ring.durationInFrames).toBe(doc.durationInFrames);
  });
});
