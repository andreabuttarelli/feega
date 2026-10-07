import type { MotionDoc } from './doc';

export enum StoryBeat {
  Problem = 'problem',
  Solution = 'solution',
  Proof = 'proof',
  Claim = 'claim'
}

export const STORY_BEATS = Object.values(StoryBeat) as [StoryBeat, ...StoryBeat[]];

export const STORY_SHARE: Record<StoryBeat, number> = {
  [StoryBeat.Problem]: 0.2,
  [StoryBeat.Solution]: 0.15,
  [StoryBeat.Proof]: 0.45,
  [StoryBeat.Claim]: 0.2
};

const PREFIX = 'story: ';

export const storyLabel = (beat: StoryBeat) => `${PREFIX}${beat}`;

export function storyBeats(doc: Pick<MotionDoc, 'markers'>): Set<StoryBeat> {
  return new Set((doc.markers ?? []).map((m) => m.label.toLowerCase().replace(PREFIX, '')).filter((l): l is StoryBeat => STORY_BEATS.includes(l as StoryBeat)));
}

export function markStory(doc: MotionDoc, beat: StoryBeat, frame: number): MotionDoc {
  const kept = (doc.markers ?? []).filter((m) => m.label !== storyLabel(beat));
  return { ...doc, markers: [...kept, { frame, label: storyLabel(beat) }].sort((a, b) => a.frame - b.frame) };
}
